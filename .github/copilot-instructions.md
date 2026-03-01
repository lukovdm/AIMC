# Copilot Instructions

**AIMC** is an AI-assisted Markov Chain editor — a full-stack web app where users photograph
hand-drawn Markov chain diagrams and get an interactive, editable graph back.

---

## Stack

### Backend

- **Python 3.13** via NixOS flake + direnv
- **uv** — package manager (`uv add`, `uv sync`, `uv run`)
- **FastAPI** — all routes mounted under `/api` prefix via `APIRouter(prefix="/api")`
- **python-dotenv** — `load_dotenv()` called in `main.py`; secrets in `.env`
- **instructor** — unified LLM structured-output client; use `instructor.from_provider("provider/model")` + `client.create(response_model=..., messages=[...])`
- **Pydantic** — all request/response schemas

### Frontend

- **React 18** + **TypeScript 5.6** + **Vite 5.4** under `frontend/`
- **vite-plugin-pwa** — installable PWA
- Vite dev proxy: `/api/*` → `http://localhost:8000` (no rewrite — backend serves under `/api`)
- `VITE_API_BASE_URL` env var overrides the origin; default is same-origin

---

## Project Layout

```
aimc/
  main.py       # FastAPI app + APIRouter; imports ocr & mc to register routes
  ocr.py        # POST /api/extract — image upload + LLM OCR → structured Model
  mc.py         # GET/PUT /api/model/{uuid}, POST /api/model/{uuid}/simulate
  storage.py    # Absolute-path file I/O for images (.jpg) and models (.json)
frontend/
  src/
    api.ts      # All fetch calls to the backend
    types.ts    # StateNode, Transition, ExtractedGraph TypeScript types
    components/ # App, CameraView, ReviewView, AnnotateView, SidePanel
resources/      # Test fixtures (ex1.jpg)
tests/
  test_api.py   # pytest — all routes tested; instructor mocked via _make_client patch
media/          # Runtime storage for uploaded images + JSON models
```

---

## Development Workflow

1. Enter the dev shell: `nix develop` (or automatically via direnv)
2. Install Python deps: `uv sync`
3. Install frontend deps: `cd frontend && npm install`
4. Run backend: `uv run fastapi dev aimc/main.py`
5. Run frontend dev server: `cd frontend && npm run dev`
6. Run tests: `uv run pytest tests/`

---

## Key Conventions

- **Source code lives under `aimc/`** (not `src/aimc/`) — the workspace root is the package root
- Prefer `uv add <package>` over editing `pyproject.toml` manually
- Keep `flake.lock` and `uv.lock` committed
- Never commit `.env`; add new secrets as `KEY=` placeholders to `.env.example` if one exists
- All backend routes are prefixed `/api` — do not add bare routes directly on `app`
- Use `router` (imported from `aimc.main`) in `ocr.py` and `mc.py` to register routes

---

## OCR / LLM Architecture

- Provider selected via `OCR_PROVIDER` env var: `"mistral"` (default) or `"claude"`
- Model IDs: `mistral/mistral-large-2512`, `anthropic/claude-sonnet-4-6`
- `_make_client()` calls `instructor.from_provider(model_id)` — lazily so tests can patch it
- `process_image(path)` is a **single function** for both providers:
  - Mistral image block: `{"type": "image_url", "image_url": "data:{mime};base64,{data}"}`
  - Claude image block: `{"type": "image", "source": {"type": "base64", "media_type": ..., "data": ...}}`
  - Single `ic.create(response_model=Model, messages=[system + image], ...)` call — no transcription pass
- Required env vars: `MISTRAL_API_KEY`, `ANTHROPIC_API_KEY`

---

## Pydantic Schema (ocr.py)

```python
class Coordinate(BaseModel):
    x: float  # [0.0, 1.0] — 0 = left, 1 = right
    y: float  # [0.0, 1.0] — 0 = top,  1 = bottom

class State(BaseModel):
    id: str; label: str; initial_state: bool; center: Coordinate; confidence: float

class Transition(BaseModel):
    from_state: str; to_state: str; action: str | None
    raw_text: str | None    # verbatim text near the arrow
    reasoning: str | None   # chain-of-thought for probability conversion
    probability: float | None
    confidence: float

class Model(BaseModel):
    states: list[State]; transitions: list[Transition]
    unattached_text: list[dict]; notes: list[str]
```

---

## Testing

- Test file: `tests/test_api.py`
- Patch `aimc.ocr._make_client` to return a mock instructor client — avoids all real API calls
- `OCR_PROVIDER` is forced to `"mistral"` via `os.environ.setdefault` before import
- Test fixture `isolated_media` monkeypatches `storage.MEDIA_DIR` to a `tmp_path`
- Real image `resources/ex1.jpg` is used for upload tests
- Run: `uv run pytest tests/test_api.py -v`
