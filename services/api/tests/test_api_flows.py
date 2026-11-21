from __future__ import annotations

from fastapi.testclient import TestClient

from services.api.app.main import app


def test_health_and_seeded_states(isolated_repo):
    client = TestClient(app)
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["firebase"]["mode"] == "local"

    st = client.get("/api/v1/states")
    assert st.status_code == 200
    assert len(st.json()["items"]) == 8


def test_dpdp_under_18_guardian_consent_and_onboarding(isolated_repo):
    client = TestClient(app)
    headers = {"Authorization": "Bearer dev:minor_user"}

    # Under 18 without guardian_consent -> rejected 422
    bad = client.put(
        "/api/v1/me",
        headers=headers,
        json={
            "full_name": "Rohan Das",
            "date_of_birth": "2014-05-01",
            "nationality_code": "IN",
            "citizen_type": "indian",
            "preferred_lang": "as",
            "guardian_consent": False,
        },
    )
    assert bad.status_code == 422

    # With guardian_consent=True -> accepted
    good = client.put(
        "/api/v1/me",
        headers=headers,
        json={
            "full_name": "Rohan Das",
            "date_of_birth": "2014-05-01",
            "nationality_code": "IN",
            "citizen_type": "indian",
            "preferred_lang": "as",
            "guardian_consent": True,
            "location_consent": False,
        },
    )
    assert good.status_code == 200
    assert good.json()["onboarding_completed"] is True


def test_trip_lifecycle_sync_conflict_and_delete_account(isolated_repo):
    client = TestClient(app)
    headers = {"Authorization": "Bearer dev:traveler_1"}

    client.put(
        "/api/v1/me",
        headers=headers,
        json={
            "full_name": "Anya Sharma",
            "date_of_birth": "1994-09-12",
            "nationality_code": "IN",
            "citizen_type": "indian",
            "preferred_lang": "en",
        },
    )

    # Generate trip
    gen = client.post(
        "/api/v1/trips/generate",
        headers=headers,
        json={"destination_state": "ML", "days": 4, "origin": "Guwahati", "budget_inr": 25000, "party_size": 2},
    )
    assert gen.status_code == 201
    trip = gen.json()["trip"]
    trip_id = trip["id"]
    assert trip["version"] >= 2

    # Offline sync with stale base_version=1 must report version conflict
    sync_res = client.post(
        "/api/v1/sync",
        headers=headers,
        json={
            "operations": [
                {
                    "op_id": "op_1",
                    "entity": "trips",
                    "action": "upsert",
                    "doc_id": trip_id,
                    "base_version": 1,
                    "data": {"title": "Offline Renamed"},
                }
            ]
        },
    )
    assert sync_res.status_code == 200
    assert len(sync_res.json()["conflicts"]) == 1
    assert sync_res.json()["conflicts"][0]["reason"] == "version_conflict"

    # Account deletion removes profile and owned trips
    del_res = client.delete("/api/v1/me", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["deleted"] is True
    assert isolated_repo.get_doc("trips", trip_id) is None


def test_admin_verify_permit_and_chat_sse_citations(isolated_repo):
    client = TestClient(app)
    traveler_headers = {"Authorization": "Bearer dev:foreign_alice"}
    admin_headers = {"Authorization": "Bearer dev:editor_bob:admin"}

    # Non-admin denied
    forbidden = client.get("/api/v1/admin/overdue", headers=traveler_headers)
    assert forbidden.status_code == 403

    # Admin verifies overdue MN-PAP permit -> writes permit_versions snapshot
    verify = client.post(
        "/api/v1/admin/permits/perm_mn_pap/verify",
        headers=admin_headers,
        json={"change_note": "Confirmed on MHA e-FRRO portal"},
    )
    assert verify.status_code == 200
    assert verify.json()["permit"]["version"] == 2
    assert len(isolated_repo.list_docs("permit_versions")) == 1

    # Traveler profile + SSE Chat test
    client.put(
        "/api/v1/me",
        headers=traveler_headers,
        json={
            "full_name": "Alice Smith",
            "date_of_birth": "1991-03-15",
            "nationality_code": "GB",
            "citizen_type": "foreign",
            "preferred_lang": "en",
        },
    )
    th = client.post("/api/v1/chat/threads", headers=traveler_headers, json={"title": "Arunachal trip"})
    assert th.status_code == 201
    tid = th.json()["thread"]["id"]

    stream = client.post(
        f"/api/v1/chat/threads/{tid}/messages",
        headers=traveler_headers,
        json={"content": "Do I need a permit for Arunachal Pradesh?"},
    )
    assert stream.status_code == 200
    assert "event: citation" in stream.text
    assert "AR-PAP" in stream.text
