import base64
import os
from pathlib import Path
from uuid import UUID, uuid4
from fastapi import HTTPException, UploadFile
from pydantic import BaseModel
import instructor

from aimc.main import router
from aimc import storage


class Coordinate(BaseModel):
    x: float  # normalized [0.0, 1.0] — 0 = left edge, 1 = right edge
    y: float  # normalized [0.0, 1.0] — 0 = top edge, 1 = bottom edge


class State(BaseModel):
    id: str
    label: str
    initial_state: bool
    center: Coordinate
    confidence: float

class Transition(BaseModel):
    from_state: str
    to_state: str
    action: str | None
    raw_text: str | None  # exact text copied from the image near the arrow
    reasoning: str | None  # chain-of-thought: how raw_text was converted to probability
    probability: float | None  # decimal value derived from raw_text
    confidence: float


class Model(BaseModel):
    states: list[State]
    transitions: list[Transition]
    unattached_text: list[dict]
    notes: list[str]


class UploadResponse(BaseModel):
    uuid: UUID
    model: Model


# ---------------------------------------------------------------------------
# Provider selection — set OCR_PROVIDER=claude or OCR_PROVIDER=mistral in .env
# ---------------------------------------------------------------------------

OCR_PROVIDER = os.environ.get("OCR_PROVIDER", "mistral").lower()

_MISTRAL_MODEL = "mistral/mistral-large-2512"
_CLAUDE_MODEL  = "anthropic/claude-sonnet-4-6"

# client is created lazily per-call so tests can patch instructor.from_provider
def _make_client() -> instructor.Instructor:
    model_id = _CLAUDE_MODEL if OCR_PROVIDER == "claude" else _MISTRAL_MODEL
    return instructor.from_provider(model_id)

# ---------------------------------------------------------------------------
# Shared prompts
# ---------------------------------------------------------------------------

EXTRACTION_SYSTEM = """\
You are a diagram parser. Extract a Markov chain from the attached image.

NOTATION CONVENTIONS:
1. Circles represent states. Text inside is the state label.
2. Directed arrows represent transitions. An arrow from state A to state B is a transition.
3. A self-loop is a circular arrow that starts and ends at the same state. Include ALL self-loops.
4. An arrow originating from empty space marks the INITIAL state.

PROBABILITIES — follow these steps for every transition:
1. Look at the image and the transcription for text written near the arrow.
2. Copy that text verbatim into "raw_text" (e.g. "1/3", "0.5", "2/5"). If nothing is written, set "raw_text": null.
3. Write your conversion in "reasoning" (e.g. "raw_text is '1/3', so 1 ÷ 3 = 0.3333").
4. Put the resulting decimal float in "probability". If raw_text is null, set "probability": null.
5. Do NOT normalize probabilities. Do NOT invent missing edges.

COORDINATES:
1. For each state's "center", give x and y as floats in [0.0, 1.0].
2. x=0.0 is the left edge, x=1.0 is the right edge; y=0.0 is the top, y=1.0 is the bottom.

CONFIDENCE: 
1. all confidence values must be floats between 0.0 and 1.0.\
"""


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

@router.post("/extract")
async def upload_file(file: UploadFile) -> UploadResponse:
    if file.content_type and file.filename and file.content_type.startswith("image/"):
        uuid = uuid4()
        contents = await file.read()
        ext = file.filename.split(".")[-1]
        path = storage.image_path(uuid, ext)
        path.write_bytes(contents)
        mc = process_image(path)
        if mc:
            storage.save_model(uuid, mc)
            return UploadResponse(uuid=uuid, model=mc)
        else:
            raise HTTPException(status_code=400, detail="could not interpret MC")
    else:
        raise HTTPException(status_code=400, detail="Unsupported file type")


# ---------------------------------------------------------------------------
# Single process_image using instructor.from_provider
# ---------------------------------------------------------------------------

def process_image(file_path: str | Path) -> Model | None:
    with open(file_path, "rb") as f:
        image_data = base64.standard_b64encode(f.read()).decode("utf-8")
    ext = Path(file_path).suffix.lstrip(".").lower()
    mime = f"image/{'jpeg' if ext in ('jpg', 'jpeg') else ext}"

    if OCR_PROVIDER == "claude":
        image_content = {
            "type": "image",
            "source": {"type": "base64", "media_type": mime, "data": image_data},
        }
    else:
        image_content = {"type": "image_url", "image_url": f"data:{mime};base64,{image_data}"}

    ic = _make_client()
    result = ic.create(
        response_model=Model,
        messages=[
            {"role": "system", "content": EXTRACTION_SYSTEM},
            {"role": "user", "content": [image_content]},
        ],
        max_tokens=2048,
        temperature=0,
    )
    if result:
        print(f"[{OCR_PROVIDER}] result: {result}")
        return result
    return None
