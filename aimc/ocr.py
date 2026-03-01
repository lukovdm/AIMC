import base64
import os
from pathlib import Path
from uuid import UUID, uuid4
from fastapi import HTTPException, UploadFile
from pydantic import BaseModel
from mistralai import Mistral

from aimc.main import router
from aimc import storage


class State(BaseModel):
    id: str
    label: str
    initial_state: bool
    center: dict[str, int]
    confidence: int

class Transition(BaseModel):
    from_state: str
    to_state: str
    action: str | None
    probability: float | None
    label_text: str | None
    confidence: int


class Model(BaseModel):
    states: list[State]
    transitions: list[Transition]
    unattached_text: list[dict]
    notes: list[str]


class UploadResponse(BaseModel):
    uuid: UUID
    model: Model


api_key = os.environ["MISTRAL_API_KEY"]
model = "ministral-8b-latest"
client = Mistral(api_key=api_key)


@router.post("/uploadfile")
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


def process_image(file_path: str | Path) -> Model | None:
    with open(file_path, "rb") as f:
        image_data = base64.standard_b64encode(f.read()).decode("utf-8")

    # Derive MIME type from extension
    ext = Path(file_path).suffix.lstrip(".").lower()
    mime = f"image/{'jpeg' if ext in ('jpg', 'jpeg') else ext}"

    chat_response = client.chat.parse(
        model=model,
        messages=[
            {
                "role": "system",
                "content": """
You are a diagram parser. Extract a Markov chain from the attached image. 
Assume the following notation conventions: Circles or rounded boxes represent states. 
Directed arrows represent transitions. Text inside a state is the state label. An arrow pointing from nothing points to the initial state.
Text near an arrow is the transition probability. If no probability is written on an outgoing edge, set "probability": null.
Do NOT normalize probabilities. Do NOT invent missing edges. confidence must be between 0 and 1.
""",
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": f"data:{mime};base64,{image_data}",
                    }
                ],
            },
        ],
        response_format=Model,
        max_tokens=1024,
        temperature=0,
    )
    if chat_response and chat_response.choices and chat_response.choices[0].message and chat_response.choices[0].message.parsed:
        return chat_response.choices[0].message.parsed
    else:
        return None

def interpret_ocr_json(json_data):
    pass
