from uuid import UUID
from aimc.main import app
from aimc.ocr import Model as AIModel
from stormvogel.model import Model as SVModel
from stormvogel.bird import build_bird
from stormvogel.simulator import simulate_path

def build_model(uuid: UUID) -> SVModel:
    model = None
    with open("media/{uuid}.json") as f:
        model = AIModel.model_validate_json(f.read())

    def delta(state, action):
        pass

    init = ""

    def labels(state):
        return []

    def available_actions(state):
        return []

    return build_bird(delta, init, labels=labels, available_actions=available_actions)

@app.get("/model/{uuid}")
def get_model(uuid: UUID) -> AIModel:
    model = None
    with open("media/{uuid}.json") as f:
        model = AIModel.model_validate_json(f.read())
    return model

@app.put("/model/{uuid}")
def update_model(uuid: UUID, model: AIModel):
    with open(f"media/{uuid}.json", "w") as f:
        f.write(AIModel.model_dump_json(model))

@app.post("/model/{uuid}/simulate")
def simulate_model(uuid: UUID, steps: int):
    model = build_model(uuid)
    path = simulate_path(model, steps)
    return {"path": path}

@app.post("/model/{uuid}/prop")
def model_check(uuid: UUID, prop: str):
    pass
