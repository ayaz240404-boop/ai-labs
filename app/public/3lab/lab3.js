const canvas = document.getElementById("draw");
const ctx = canvas.getContext("2d", { willReadFrequently: true });

const btnClear = document.getElementById("btnClear");
const btnPredict = document.getElementById("btnPredict");
const statusEl = document.getElementById("status");
const outLetter = document.getElementById("outLetter");
const outProb = document.getElementById("outProb");
const top5El = document.getElementById("top5");

// фон белый
function fillWhite() {
  ctx.save();
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
}
fillWhite();

// кисть
ctx.lineWidth = 11;
ctx.lineCap = "round";
ctx.lineJoin = "round";
ctx.strokeStyle = "#000";

let drawing = false;

function pos(e) {
  const rect = canvas.getBoundingClientRect();
  const t = e.touches?.[0];
  const clientX = t ? t.clientX : e.clientX;
  const clientY = t ? t.clientY : e.clientY;
  return {
    x: (clientX - rect.left) * (canvas.width / rect.width),
    y: (clientY - rect.top) * (canvas.height / rect.height),
  };
}

function start(e) {
  drawing = true;
  const p = pos(e);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  e.preventDefault();
}

function move(e) {
  if (!drawing) return;
  const p = pos(e);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
  e.preventDefault();
}

function end(e) {
  drawing = false;
  e.preventDefault();
}

canvas.addEventListener("mousedown", start);
canvas.addEventListener("mousemove", move);
window.addEventListener("mouseup", end);

canvas.addEventListener("touchstart", start, { passive: false });
canvas.addEventListener("touchmove", move, { passive: false });
canvas.addEventListener("touchend", end, { passive: false });

btnClear.addEventListener("click", () => {
  fillWhite();
  statusEl.textContent = "Очищено.";
  outLetter.textContent = "—";
  outProb.textContent = "—";
  top5El.textContent = "—";
});

btnPredict.addEventListener("click", async () => {
  btnPredict.disabled = true;
  statusEl.textContent = "Распознаю...";
  outLetter.textContent = "…";
  outProb.textContent = "…";
  top5El.textContent = "…";

  try {
    const dataUrl = canvas.toDataURL("image/png"); // data:image/png;base64,...

    const res = await fetch("predict.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image_base64: dataUrl }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = json?.detail || json?.error || `HTTP ${res.status}`;
      throw new Error(msg);
    }

    statusEl.textContent = "Готово.";
    outLetter.textContent = json.letter ?? "?";
    outProb.textContent = json.prob != null
      ? `вероятность: ${(json.prob * 100).toFixed(2)}%`
      : "—";

    if (Array.isArray(json.top5)) {
      top5El.textContent = json.top5
        .map((x) => `${x.letter}: ${(x.prob * 100).toFixed(2)}%`)
        .join("\n");
    } else {
      top5El.textContent = "—";
    }
  } catch (e) {
    statusEl.textContent = "Ошибка: " + (e?.message || e);
    outLetter.textContent = "—";
    outProb.textContent = "—";
    top5El.textContent = "—";
  } finally {
    btnPredict.disabled = false;
  }
});
