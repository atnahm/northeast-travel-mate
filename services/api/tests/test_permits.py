from __future__ import annotations

import pytest

from services.common.permit_engine import build_permit_checklist


@pytest.mark.parametrize(
    "state_code,destination_id,citizen_type,dob,expected_required,expected_codes",
    [
        ("AR", None, "indian", "1995-05-10", True, {"AR-ILP"}),
        ("AR", "place_ar_tawang", "foreign", "1992-01-15", True, {"AR-PAP"}),
        ("AR", "place_ar_tawang", "oci_pio", "1988-08-20", True, {"AR-PAP"}),
        ("NL", None, "indian", "1998-03-01", True, {"NL-ILP"}),
        ("NL", None, "foreign", "1990-07-11", True, {"NL-FOREIGN"}),
        ("MZ", None, "indian", "2000-02-02", True, {"MZ-ILP"}),
        ("MN", None, "indian", "1994-11-11", True, {"MN-ILP"}),
        ("MN", None, "foreign", "1994-11-11", True, {"MN-PAP"}),
        ("SK", "place_sk_gangtok", "foreign", "1991-06-06", True, {"SK-RAP"}),
        ("SK", "place_sk_tsomgo", "indian", "1996-04-04", True, {"SK-PAP-HIGH"}),
        ("AS", "place_as_kaziranga", "indian", "1993-09-09", True, {"AS-KNP-ENTRY"}),
        ("AS", None, "indian", "1993-09-09", False, {"AS-KNP-ENTRY"}),
        ("ML", "place_ml_shillong", "indian", "1993-09-09", False, {"ML-ENTRY"}),
        ("TR", "place_tr_unakoti", "foreign", "1989-12-01", False, {"TR-ENTRY"}),
        ("AR", None, "indian", "2014-01-01", True, {"AR-ILP"}),
    ],
)
def test_permit_matrix(
    isolated_repo,
    state_code,
    destination_id,
    citizen_type,
    dob,
    expected_required,
    expected_codes,
):
    res = build_permit_checklist(
        repo=isolated_repo,
        citizen_type=citizen_type,
        nationality_code="US" if citizen_type == "foreign" else "IN",
        date_of_birth=dob,
        destination_id=destination_id,
        state_code=state_code,
        lang="en",
    )
    items = res["items"]
    codes = {it["code"] for it in items}
    assert expected_codes.issubset(codes)
    if expected_required:
        assert any(it["required"] and it["code"] in expected_codes for it in items)
    else:
        assert all(not it["required"] for it in items)


def test_retired_permits_excluded_and_stale_flagged(isolated_repo):
    # Mark perm_ml_no_ilp retired -> must not appear
    isolated_repo.update_doc("permits", "perm_ml_no_ilp", {"status": "retired"})
    ml_res = build_permit_checklist(repo=isolated_repo, citizen_type="indian", state_code="ML")
    assert all(it["permit_id"] != "perm_ml_no_ilp" for it in ml_res["items"])

    # perm_mn_pap in seed is intentionally dated > 90 days ago -> must flag needs_check=True
    mn_res = build_permit_checklist(repo=isolated_repo, citizen_type="foreign", state_code="MN")
    pap = next(it for it in mn_res["items"] if it["code"] == "MN-PAP")
    assert pap["needs_check"] is True
