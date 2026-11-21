from __future__ import annotations

from datetime import date, timedelta
from typing import List

import pytest
from fastapi.testclient import TestClient

from services.api.app.integrations.railway import RailwayProvider, map_live_status
from services.api.app.main import app
from services.api.app.services.train_service import get_live_status_service, search_trains_service
from services.common.cache import CacheClient
from services.common.train_data import destination_by_id, destinations, search_local
from services.common.trains import LiveStatus, TrainRoute, TrainSummary, now_ist_iso, today_ist


class CountingStubProvider(RailwayProvider):
    name = "stub-test-provider"

    def __init__(self) -> None:
        self.search_calls = 0
        self.status_calls: List[str] = []

    async def search_trains(self, from_code: str, to_code: str, journey_date: date) -> List[TrainSummary]:
        self.search_calls += 1
        return []

    async def get_train_route(self, train_no: str) -> TrainRoute:
        return TrainRoute(train_no=train_no, name="Stub", type="Express", stops=[], source="live", fetched_at=now_ist_iso(), provider=self.name)

    async def get_live_status(self, train_no: str, start_date: date) -> LiveStatus:
        self.status_calls.append(start_date.isoformat())
        delay = 25 if start_date == today_ist() else 0
        return LiveStatus(
            train_no=train_no,
            start_date=start_date.isoformat(),
            state="running",
            current_station_code="LMG",
            next_station_code="DMV",
            delay_min=delay,
            stops=[],
            fetched_at=now_ist_iso(),
            provider=self.name,
            source="live",
            message=f"Running for startDate={start_date.isoformat()}",
        )


def test_acceptance_1_guwahati_to_dibrugarh(isolated_repo):
    client = TestClient(app)
    today = today_ist().isoformat()
    r = client.get(f"/api/v1/trains/search?from=GHY&to=DBRG&date={today}")
    assert r.status_code == 200
    body = r.json()
    assert body["sameRailhead"] is False
    assert body["source"] == "scheduled_fallback"
    assert len(body["trains"]) >= 2
    # Overnight Rajdhani/Kamrup arrives +1 day
    overnight = [t for t in body["trains"] if t["arrivalDayOffset"] == 1]
    assert len(overnight) >= 1
    assert all(t["durationMin"] > 0 for t in overnight)


def test_acceptance_2_kaziranga_railheads_and_road_leg(isolated_repo):
    kaz = destination_by_id("kaziranga")
    assert kaz is not None
    assert kaz["hasDirectRail"] is False
    codes = [rh["code"] for rh in kaz["railheads"]]
    assert codes[0] == "FKG"
    assert "JTTN" in codes
    assert kaz["railheads"][0]["roadKm"] is not None
    assert kaz["railheads"][0]["road"]["lastVerifiedAt"] is not None


def test_acceptance_3_guwahati_to_shillong_same_railhead_zero_provider_calls():
    stub = CountingStubProvider()
    shillong = destination_by_id("shillong")
    assert shillong is not None
    assert shillong["railheads"][0]["code"] == "GHY"
    assert shillong["railheads"][0]["road"]["lastVerifiedAt"] is not None

    import asyncio

    res = asyncio.run(search_trains_service("GHY", "GHY", today_ist(), provider=stub, cache=CacheClient()))
    assert res["sameRailhead"] is True
    assert res["trains"] == []
    assert stub.search_calls == 0


def test_acceptance_4_tawang_permit_hint_from_verified_db_not_json(isolated_repo):
    # Ensure NO destination in ne-railheads.json hard-codes permitRequired
    for d in destinations():
        assert "permitRequired" not in d

    client = TestClient(app)
    r = client.get("/api/v1/trains/stations?q=Tawang")
    assert r.status_code == 200
    tawang = next(item for item in r.json()["items"] if item.get("id") == "tawang")
    assert tawang["permitHint"] is not None
    assert tawang["permitHint"]["mayRequirePermit"] is True
    assert "/permits?" in tawang["permitHint"]["permitsPath"]


def test_acceptance_5_aizawl_uses_sairang_direct_rail(isolated_repo):
    aizawl = destination_by_id("aizawl")
    assert aizawl is not None
    assert aizawl["hasDirectRail"] is True
    assert aizawl["railheads"][0]["code"] == "SANG"
    assert aizawl["railheads"][1]["code"] == "SCL"
    assert aizawl["railheads"][0]["roadKm"] is not None

    client = TestClient(app)
    today = today_ist().isoformat()
    r = client.get(f"/api/v1/trains/search?from=GHY&to=SANG&date={today}")
    assert r.status_code == 200
    assert any(t["trainNo"] == "15609" for t in r.json()["trains"])


def test_acceptance_6_no_provider_key_uses_labelled_fallback_never_fake_on_time(isolated_repo, monkeypatch):
    monkeypatch.setenv("RAPIDAPI_RAILWAY_KEY", "")
    from services.common.config import get_settings

    get_settings.cache_clear()
    client = TestClient(app)
    today = today_ist().isoformat()

    sr = client.get(f"/api/v1/trains/search?from=GHY&to=DMV&date={today}")
    assert sr.status_code == 200
    assert sr.json()["source"] == "scheduled_fallback"
    assert sr.json()["verifiedAt"] is not None
    assert len(sr.json()["trains"]) >= 1

    st = client.get(f"/api/v1/trains/12067/status?startDate={today}")
    assert st.status_code == 200
    body = st.json()
    assert body["state"] == "unavailable"
    assert body["delayMin"] is None
    assert body["source"] == "scheduled_fallback"
    assert all(stop["platform"] is None for stop in body["stops"])


def test_acceptance_7_started_on_today_vs_yesterday_distinct():
    import asyncio

    stub = CountingStubProvider()
    cache = CacheClient()
    today = today_ist()
    yesterday = today - timedelta(days=1)

    r_today = asyncio.run(get_live_status_service("12067", today, provider=stub, cache=cache))
    r_yest = asyncio.run(get_live_status_service("12067", yesterday, provider=stub, cache=cache))

    assert r_today["startDate"] == today.isoformat()
    assert r_yest["startDate"] == yesterday.isoformat()
    assert r_today["delayMin"] == 25
    assert r_yest["delayMin"] == 0
    assert r_today["provider"] == "stub-test-provider"
    assert r_today["fetchedAt"] is not None
    assert len(stub.status_calls) == 2


def test_acceptance_9_cancelled_train_mapper():
    mapped = map_live_status(
        {"data": {"status_message": "Train has been cancelled today", "previous_stations": [], "upcoming_stations": []}},
        train_no="12067",
        start_date=today_ist(),
        provider="rapidapi-irctc",
        fetched_at=now_ist_iso(),
    )
    assert mapped.state == "cancelled"
    assert mapped.delay_min is None


def test_validation_rejects_invalid_train_number_and_past_date(isolated_repo):
    client = TestClient(app)
    assert client.get("/api/v1/trains/123/status").status_code == 422
    assert client.get("/api/v1/trains/ABCDE/route").status_code == 422
    past = (today_ist() - timedelta(days=3)).isoformat()
    assert client.get(f"/api/v1/trains/search?from=GHY&to=DMV&date={past}").status_code == 422
