from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI

load_dotenv()

app = FastAPI()
router = APIRouter(prefix="/api")


@router.get("/")
def read_root():
    return {"Hello": "World"}


# Routers from ocr and mc are registered on `router` then included below.
# Import them after router is defined to avoid circular imports.
import aimc.ocr  # noqa: E402, F401
import aimc.mc  # noqa: E402, F401

app.include_router(router)
