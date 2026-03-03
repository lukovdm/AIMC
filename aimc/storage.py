import os
from pathlib import Path
from uuid import UUID
from fastapi import HTTPException
from sqlmodel import Field, Session, SQLModel, create_engine, select

# ---------------------------------------------------------------------------
# DB location — one file next to the project root
# ---------------------------------------------------------------------------

_DB_PATH = Path(os.environ.get("AIMC_DB_PATH", str(Path(__file__).parent.parent / "aimc.db")))


def get_engine():
    """Return the SQLAlchemy engine. Replaced in tests to use an in-memory DB."""
    engine = create_engine(f"sqlite:///{_DB_PATH}")
    SQLModel.metadata.create_all(engine)
    return engine


# ---------------------------------------------------------------------------
# Table
# ---------------------------------------------------------------------------

class ModelRecord(SQLModel, table=True):
    uuid: str = Field(primary_key=True)
    data: str  # JSON blob


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def save_model(uuid: UUID, model) -> None:
    """Persist a model to the database."""
    with Session(get_engine()) as session:
        record = session.get(ModelRecord, str(uuid))
        if record:
            record.data = model.model_dump_json()
        else:
            record = ModelRecord(uuid=str(uuid), data=model.model_dump_json())
        session.add(record)
        session.commit()


def load_model(uuid: UUID):
    """Load and return a validated Model, or raise HTTP 404."""
    from aimc.ocr import Model  # local import to avoid circular dependency

    with Session(get_engine()) as session:
        record = session.get(ModelRecord, str(uuid))
    if record is None:
        raise HTTPException(status_code=404, detail="Model not found")
    return Model.model_validate_json(record.data)
