from __future__ import annotations

import os
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))


@pytest.fixture()
def isolated_repo(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("FIREBASE_MODE", "local")
    monkeypatch.setenv("DEV_AUTH_BYPASS", "true")

    from services.common import config, firebase_client, repository

    config.get_settings.cache_clear()
    firebase_client.reset_firebase_state_for_tests()
    repository.reset_repo_for_tests()

    # Point local DB dir into pytest temp directory
    settings = config.get_settings()
    monkeypatch.setattr(config.Settings, "local_db_dir", property(lambda self: tmp_path / "local_db"))
    monkeypatch.setattr(config.Settings, "local_uploads_dir", property(lambda self: tmp_path / "local_uploads"))

    firebase_client.init_firebase(force_mode="local")
    repo = repository.get_repo()

    from data.seed.seed_firestore import seed_all

    seed_all(repo)
    yield repo

    repository.reset_repo_for_tests()
    firebase_client.reset_firebase_state_for_tests()
    config.get_settings.cache_clear()
