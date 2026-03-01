"""
Tests for the AIMC FastAPI routes.

Mistral is mocked so tests run fully offline without an API key.
The real image from resources/ex1.jpg is used for the upload endpoint
to exercise file handling, MIME detection and JSON persistence.
"""

import json
import os
from pathlib import Path
from unittest.mock import MagicMock, patch
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

# Ensure MISTRAL_API_KEY is set before the app modules are imported,
# otherwise os.environ["MISTRAL_API_KEY"] in ocr.py raises KeyError.
os.environ.setdefault("MISTRAL_API_KEY", "test-key")

from aimc.main import app  # noqa: E402
import aimc.ocr  # noqa: E402  – imported so we can patch its globals
import aimc.mc   # noqa: E402  – registers routes
import aimc.storage as storage  # noqa: E402

RESOURCES = Path(__file__).parent.parent / "resources"
EX1_JPG = RESOURCES / "ex1.jpg"

client = TestClient(app)


# ---------------------------------------------------------------------------
# Fixture: redirect storage to a temp directory for every test
# ---------------------------------------------------------------------------

@pytest.fixture(autouse=True)
def isolated_media(tmp_path, monkeypatch):
    """Point storage.MEDIA_DIR at a fresh tmp directory for each test."""
    monkeypatch.setattr(storage, "MEDIA_DIR", tmp_path / "media")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

FAKE_MODEL = {
    "states": [
        {"id": "s0", "label": "S0", "initial_state": True,  "center": {"x": 100, "y": 100}, "confidence": 1},
        {"id": "s1", "label": "S1", "initial_state": False, "center": {"x": 300, "y": 100}, "confidence": 1},
    ],
    "transitions": [
        {
            "from_state": "s0",
            "to_state": "s1",
            "action": None,
            "probability": 0.8,
            "label_text": "0.8",
            "confidence": 1,
        },
        {
            "from_state": "s0",
            "to_state": "s0",
            "action": None,
            "probability": 0.2,
            "label_text": "0.2",
            "confidence": 1,
        },
    ],
    "unattached_text": [],
    "notes": [],
}


def make_parsed_response(model_dict: dict):
    """Return a mock that looks like a Mistral chat.parse response."""
    from aimc.ocr import Model

    parsed = Model.model_validate(model_dict)
    message = MagicMock()
    message.parsed = parsed
    choice = MagicMock()
    choice.message = message
    response = MagicMock()
    response.choices = [choice]
    return response


# ---------------------------------------------------------------------------
# GET /
# ---------------------------------------------------------------------------

def test_root():
    r = client.get("/api/")
    assert r.status_code == 200
    assert r.json() == {"Hello": "World"}


# ---------------------------------------------------------------------------
# POST /uploadfile
# ---------------------------------------------------------------------------

class TestUploadFile:
    def test_upload_real_image_mocked_mistral(self, tmp_path):
        """Upload ex1.jpg; Mistral is mocked; check response shape and file persistence."""
        mock_response = make_parsed_response(FAKE_MODEL)
        with patch.object(aimc.ocr.client.chat, "parse", return_value=mock_response):
            with open(EX1_JPG, "rb") as f:
                r = client.post(
                    "/api/uploadfile",
                    files={"file": ("ex1.jpg", f, "image/jpeg")},
                )

        assert r.status_code == 200
        data = r.json()
        assert "uuid" in data
        assert "model" in data
        assert len(data["model"]["states"]) == 2
        assert len(data["model"]["transitions"]) == 2

        # JSON file should have been persisted via storage
        uuid = data["uuid"]
        saved = storage.MEDIA_DIR / f"{uuid}.json"
        assert saved.exists()
        assert json.loads(saved.read_text())["states"][0]["id"] == "s0"

    def test_upload_non_image_rejected(self):
        r = client.post(
            "/api/uploadfile",
            files={"file": ("data.csv", b"a,b,c", "text/csv")},
        )
        assert r.status_code == 400
        assert "Unsupported file type" in r.json()["detail"]

    def test_upload_mistral_returns_none_gives_400(self):
        with patch.object(aimc.ocr.client.chat, "parse", return_value=MagicMock(choices=[])):
            with open(EX1_JPG, "rb") as f:
                r = client.post(
                    "/api/uploadfile",
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

        updated = {**FAKE_MODEL, "notes": ["updated"]}
        r = client.put(f"/api/model/{uuid}", json=updated)
        assert r.status_code == 200

        saved = json.loads((storage.MEDIA_DIR / f"{uuid}.json").read_text())
        assert saved["notes"] == ["updated"]

    def test_update_with_invalid_body_gives_422(self):
        r = client.put(f"/api/model/{uuid4()}", json={"bad": "data"})
        assert r.status_code == 422
