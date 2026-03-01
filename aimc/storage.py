from pathlib import Path
from uuid import UUID
from fastapi import HTTPException

# Resolved once at import time — always correct regardless of working directory.
MEDIA_DIR = Path(__file__).parent.parent / "media"


def _dir() -> Path:
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    return MEDIA_DIR


def image_path(uuid: UUID, ext: str) -> Path:
    """Return the absolute path for a stored image file."""
    return _dir() / f"{uuid}.{ext}"


def save_model(uuid: UUID, model) -> None:
    """Persist a model to JSON."""
    (_dir() / f"{uuid}.json").write_text(model.model_dump_json())


def load_model(uuid: UUID):
    """Load and return a validated Model, or raise HTTP 404."""
    from aimc.ocr import Model  # local import to avoid circular dependency

    path = _dir() / f"{uuid}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Model not found")
    return Model.model_validate_json(path.read_text())
