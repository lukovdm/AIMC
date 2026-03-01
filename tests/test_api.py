"""
Tests for the AIMC FastAPI routes.

instructor.from_provider is mocked so tests run fully offline without an API key.
The real image from resources/ex1.jpg is used for the upload endpoint
to exercise file handling, MIME detection and DB persistence.
"""

import os
from pathlib import Path
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, create_engine
from sqlalchemy.pool import StaticPool

# Ensure API keys are set before the app modules are imported.
os.environ.setdefault("MISTRAL_API_KEY", "test-key")
os.environ.setdefault("ANTHROPIC_API_KEY", "test-key")
os.environ.setdefault("OCR_PROVIDER", "mistral")

from aimc.main import app  # noqa: E402
import aimc.ocr  # noqa: E402  – imported so we can patch its globals
import aimc.mc   # noqa: E402  – registers routes
import aimc.storage as storage  # noqa: E402

RESOURCES = Path(__file__).parent.parent / "resources"
EX1_JPG = RESOURCES / "ex1.jpg"

client = TestClient(app)


# ---------------------------------------------------------------------------
# Fixture: isolated in-memory SQLite DB for every test
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def isolated_db(monkeypatch):
    """Patch storage.get_engine to return a fresh in-memory SQLite engine per test.
    StaticPool ensures all sessions share the same in-memory connection."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    monkeypatch.setattr(storage, "get_engine", lambda: engine)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

FAKE_MODEL = {
    "states": [
        {"id": "s0", "label": "S0", "initial_state": True,  "center": {"x": 0.1, "y": 0.5}, "confidence": 0.95},
        {"id": "s1", "label": "S1", "initial_state": False, "center": {"x": 0.9, "y": 0.5}, "confidence": 0.95},
    ],
    "transitions": [
        {
            "from_state": "s0",
            "to_state": "s1",
            "action": None,
            "probability": 0.8,
            "confidence": 0.9,
        },
        {
            "from_state": "s0",
            "to_state": "s0",
            "action": None,
            "probability": 0.2,
            "confidence": 0.9,
        },
    ],
}


def make_instructor_client(model_dict: dict | None):
    """Return a mock instructor client whose .create_with_completion() returns (Model, completion)."""
    from aimc.ocr import Model

    mock_ic = MagicMock()
    if model_dict is not None:
        parsed = Model.model_validate(model_dict)
        mock_completion = MagicMock()
        mock_completion.usage = None
        mock_ic.create_with_completion.return_value = (parsed, mock_completion)
    else:
        mock_ic.create_with_completion.return_value = (None, MagicMock())
    return mock_ic


def instructor_patch(model_dict: dict | None):
    """Context manager: patch aimc.ocr._make_client to return a mock instructor client."""
    return patch("aimc.ocr._make_client", return_value=make_instructor_client(model_dict))


# ---------------------------------------------------------------------------
# GET /
# ---------------------------------------------------------------------------

def test_root():
    r = client.get("/api/")
    assert r.status_code == 200
    assert r.json() == {"Hello": "World"}


# ---------------------------------------------------------------------------
# POST /api/extract
# ---------------------------------------------------------------------------

class TestUploadFile:
    def test_upload_real_image_mocked_mistral(self, tmp_path):
        """Upload ex1.jpg; instructor is mocked; check response shape and persistence."""
        with instructor_patch(FAKE_MODEL):
            with open(EX1_JPG, "rb") as f:
                r = client.post(
                    "/api/extract",
                    files={"file": ("ex1.jpg", f, "image/jpeg")},
                )

        assert r.status_code == 200
        data = r.json()
        assert "uuid" in data
        assert "model" in data
        assert len(data["model"]["states"]) == 2
        assert len(data["model"]["transitions"]) == 2

        # Model should have been persisted — round-trip via load_model
        uuid = data["uuid"]
        loaded = storage.load_model(uuid)
        assert loaded.states[0].id == "s0"

    def test_upload_non_image_rejected(self):
        r = client.post(
            "/api/extract",
            files={"file": ("data.csv", b"a,b,c", "text/csv")},
        )
        assert r.status_code == 400
        assert "Unsupported file type" in r.json()["detail"]

    def test_upload_mistral_returns_none_gives_400(self):
        with instructor_patch(None):
            with open(EX1_JPG, "rb") as f:
                r = client.post(
                    "/api/extract",
                    files={"file": ("ex1.jpg", f, "image/jpeg")},
                )

        assert r.status_code == 400
        assert "could not interpret" in r.json()["detail"]


# ---------------------------------------------------------------------------
# GET /model/{uuid}
# ---------------------------------------------------------------------------

class TestGetModel:
    def test_get_existing_model(self, tmp_path):
        uuid = uuid4()
        storage.save_model(uuid, aimc.ocr.Model.model_validate(FAKE_MODEL))

        r = client.get(f"/api/model/{uuid}")
        assert r.status_code == 200
        assert r.json()["states"][0]["id"] == "s0"

    def test_get_missing_model_gives_404(self):
        r = client.get(f"/api/model/{uuid4()}")
        assert r.status_code == 404
        assert "not found" in r.json()["detail"].lower()


# ---------------------------------------------------------------------------
# PUT /model/{uuid}
# ---------------------------------------------------------------------------

class TestUpdateModel:
    def test_update_model(self, tmp_path):
        uuid = uuid4()
        storage.save_model(uuid, aimc.ocr.Model.model_validate(FAKE_MODEL))

        updated = {**FAKE_MODEL, "states": [{**FAKE_MODEL["states"][0], "label": "Updated"}, FAKE_MODEL["states"][1]]}
        r = client.put(f"/api/model/{uuid}", json=updated)
        assert r.status_code == 200

        loaded = storage.load_model(uuid)
        assert loaded.states[0].label == "Updated"

    def test_update_with_invalid_body_gives_422(self):
        r = client.put(f"/api/model/{uuid4()}", json={"bad": "data"})
        assert r.status_code == 422
