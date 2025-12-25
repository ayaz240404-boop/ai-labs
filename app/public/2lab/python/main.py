from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class Req(BaseModel):
    a: float
    b: float
    c: float
    d: float
    x_min: float = -10
    x_max: float = 53
    pop_size: int = 80
    generations: int = 80
    seed: int | None = None

@app.get("/health")
def health():
    return {"ok": True}

@app.post("/run")
def run(req: Req):
    return {"received": req.model_dump()}
