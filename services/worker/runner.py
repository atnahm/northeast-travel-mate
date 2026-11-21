from __future__ import annotations

import logging
import uuid

from data.seed.seed_firestore import _build_kb_chunks
from services.common.firebase_client import init_firebase
from services.common.permit_engine import is_verification_stale
from services.common.repository import get_repo, utc_now_iso

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] worker: %(message)s")
logger = logging.getLogger("ne_mate.worker")


def run_maintenance_cycle() -> dict:
    init_firebase()
    repo = get_repo()

    permits = repo.list_docs("permits")
    places = repo.list_docs("places")
    specialities = repo.list_docs("specialities")
    festivals = repo.list_docs("festivals")

    chunks = _build_kb_chunks(permits, places, specialities, festivals)
    indexed = repo.batch_set("kb_chunks", chunks)

    overdue_permits = [p["id"] for p in permits if is_verification_stale(p.get("last_verified_at"), threshold_days=90)]
    overdue_transport = [
        t["id"]
        for t in repo.list_docs("transport_options")
        if is_verification_stale(t.get("last_verified_at"), threshold_days=14)
    ]

    run_id = f"job_{uuid.uuid4().hex[:10]}"
    report = {
        "id": run_id,
        "ran_at": utc_now_iso(),
        "kb_chunks_indexed": indexed,
        "overdue_permits_count": len(overdue_permits),
        "overdue_permit_ids": overdue_permits,
        "overdue_transport_count": len(overdue_transport),
        "overdue_transport_ids": overdue_transport,
        "status": "completed",
    }
    repo.set_doc("job_runs", run_id, report)
    logger.info("Worker maintenance cycle complete: %s", report)
    return report


if __name__ == "__main__":
    run_maintenance_cycle()
