from fastapi import FastAPI
from pydantic import BaseModel, Field
import random
import math

app = FastAPI()


class Req(BaseModel):
    a: float
    b: float
    c: float
    d: float

    x_min: float = -10.0
    x_max: float = 53.0

    pop_size: int = Field(default=80, ge=10, le=500)
    generations: int = Field(default=80, ge=1, le=2000)
    seed: int | None = None

    # параметры ГА (можно менять с фронта при желании)
    tournament_k: int = Field(default=5, ge=2, le=30)
    elite: int = Field(default=2, ge=0, le=20)

    mutation_rate: float = Field(default=0.25, ge=0.0, le=1.0)
    mutation_sigma: float = Field(default=2.0, ge=0.0, le=100.0)

    crossover_alpha: float = Field(default=0.5, ge=0.0, le=2.0)


@app.get("/health")
def health():
    return {"ok": True}


def clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def fx(a: float, b: float, c: float, d: float, x: float) -> float:
    return a + b * x + c * (x**2) + d * (x**3)


def run_ga(req: Req, maximize: bool) -> dict:
    if req.seed is not None:
        random.seed(req.seed if maximize else req.seed + 1)

    def fitness(x: float) -> float:
        v = fx(req.a, req.b, req.c, req.d, x)
        return v if maximize else -v

    def tournament(pop: list[float]) -> float:
        sample = random.sample(pop, req.tournament_k)
        return max(sample, key=fitness)

    # BLX-alpha crossover
    def crossover(p1: float, p2: float) -> float:
        cmin, cmax = (p1, p2) if p1 <= p2 else (p2, p1)
        I = cmax - cmin
        left = cmin - req.crossover_alpha * I
        right = cmax + req.crossover_alpha * I
        child = random.uniform(left, right)
        return clamp(child, req.x_min, req.x_max)

    def mutate(x: float) -> float:
        if random.random() < req.mutation_rate:
            x = x + random.gauss(0.0, req.mutation_sigma)
        return clamp(x, req.x_min, req.x_max)

    # init population
    pop = [random.uniform(req.x_min, req.x_max) for _ in range(req.pop_size)]

    hist_best_x: list[float] = []
    hist_best_fx: list[float] = []
    hist_avg_fx: list[float] = []

    best_x = pop[0]
    best_fit = -math.inf

    for _gen in range(req.generations):
        fx_vals = [fx(req.a, req.b, req.c, req.d, x) for x in pop]
        fits = [v if maximize else -v for v in fx_vals]

        # best in generation
        best_i = max(range(len(pop)), key=lambda i: fits[i])
        gen_best_x = pop[best_i]
        gen_best_fx = fx_vals[best_i]
        gen_avg_fx = sum(fx_vals) / len(fx_vals)

        # best overall
        if fits[best_i] > best_fit:
            best_fit = fits[best_i]
            best_x = gen_best_x

        hist_best_x.append(gen_best_x)
        hist_best_fx.append(gen_best_fx)
        hist_avg_fx.append(gen_avg_fx)

        # elitism
        if req.elite > 0:
            elites = sorted(pop, key=fitness, reverse=True)[: req.elite]
        else:
            elites = []

        new_pop = list(elites)

        while len(new_pop) < req.pop_size:
            p1 = tournament(pop)
            p2 = tournament(pop)
            child = crossover(p1, p2)
            child = mutate(child)
            new_pop.append(child)

        pop = new_pop

    best_fx = fx(req.a, req.b, req.c, req.d, best_x)

    return {
        "x": best_x,
        "fx": best_fx,
        "history": {
            "best_x": hist_best_x,
            "best_fx": hist_best_fx,
            "avg_fx": hist_avg_fx,
        },
    }


@app.post("/run")
def run(req: Req):
    out_max = run_ga(req, maximize=True)
    out_min = run_ga(req, maximize=False)

    return {
        "params": req.model_dump(),
        "max": out_max,
        "min": out_min,
    }
