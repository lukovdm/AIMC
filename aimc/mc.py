from uuid import UUID
from aimc.main import router
from aimc.ocr import Model as AIModel
from aimc import storage
from stormvogel.model import Model as SVModel
from stormvogel.bird import build_bird
from stormvogel.simulator import simulate_path

def build_model(uuid: UUID) -> SVModel:
    model = storage.load_model(uuid)

    def delta(state, action):
        pass

    init = ""

    def labels(state):
        return []

    def available_actions(state):
        return []

    return build_bird(delta, init, labels=labels, available_actions=available_actions)

@router.get("/model/{uuid}")
def get_model(uuid: UUID) -> AIModel:
    return storage.load_model(uuid)

@router.put("/model/{uuid}")
def update_model(uuid: UUID, model: AIModel):
    storage.save_model(uuid, model)

@router.post("/model/{uuid}/simulate")
def simulate_model(uuid: UUID, steps: int):
    model = build_model(uuid)
    path = simulate_path(model, steps)
    return {"path": path}

@router.post("/model/{uuid}/prop")
def model_check(uuid: UUID, prop: str):
    pass
