from __future__ import annotations

import base64
import io
import os
import re
from typing import List

import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from PIL import Image, ImageOps, ImageFilter

from tensorflow.keras.models import load_model

MODEL_PATH = os.path.join(os.path.dirname(__file__), "model", "letters_model.h5")
LETTERS = [chr(ord("A") + i) for i in range(26)]


INVERT_INPUT = True

app = FastAPI(title="AI Lab 3 - Letters Recognition")

model = None 


class PredictRequest(BaseModel):
    image_base64: str


class TopKItem(BaseModel):
    letter: str
    prob: float


class PredictResponse(BaseModel):
    letter: str
    prob: float
    top5: List[TopKItem]


def _decode_base64_image(s: str) -> Image.Image:
    m = re.match(r"^data:image\/[a-zA-Z0-9.+-]+;base64,(.*)$", s)
    if m:
        s = m.group(1)

    try:
        raw = base64.b64decode(s, validate=True)
    except Exception:
        try:
            raw = base64.b64decode(s + "===")
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid base64 image")

    try:
        img = Image.open(io.BytesIO(raw))
        img.load()
        return img
    except Exception:
        raise HTTPException(status_code=400, detail="Unsupported image format")


def _preprocess(img: Image.Image) -> np.ndarray:
    img = img.convert("L")

    inv = ImageOps.invert(img)
    bbox = inv.getbbox()
    if bbox is None:
        raise HTTPException(status_code=400, detail="Empty image (no strokes)")
    img = img.crop(bbox)

    w, h = img.size
    side = max(w, h)
    padded = Image.new("L", (side, side), color=255) 
    padded.paste(img, ((side - w) // 2, (side - h) // 2))

    img28 = padded.resize((28, 28), resample=Image.Resampling.BILINEAR)
    img28 = img28.filter(ImageFilter.MinFilter(3))
    if INVERT_INPUT:
        img28 = ImageOps.invert(img28)

    arr = np.array(img28, dtype=np.float32)

    arr = np.rot90(arr, k=3)
    
    arr = arr / 255.0
    arr = arr.reshape(1, 28, 28)
    return arr


@app.on_event("startup")
def _load():
    global model
    if not os.path.exists(MODEL_PATH):
        raise RuntimeError(f"Model not found: {MODEL_PATH}")
    model = load_model(MODEL_PATH)
    _ = model.predict(np.zeros((1, 28, 28), dtype=np.float32), verbose=0)


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest):
    if model is None:
        raise HTTPException(status_code=500, detail="Model not loaded")

    img = _decode_base64_image(req.image_base64)
    x = _preprocess(img)

    probs = model.predict(x, verbose=0)[0]  # (26,)
    idx = int(np.argmax(probs))
    letter = LETTERS[idx]
    prob = float(probs[idx])

    top_idx = np.argsort(probs)[::-1][:5]
    top5 = [{"letter": LETTERS[int(i)], "prob": float(probs[int(i)])} for i in top_idx]

    return {"letter": letter, "prob": prob, "top5": top5}
