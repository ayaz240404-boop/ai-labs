(() => {
  const btn = document.getElementById("gaRun");
  const statusEl = document.getElementById("gaStatus");
  const maxOut = document.getElementById("maxOut");
  const minOut = document.getElementById("minOut");

  const aEl = document.getElementById("a");
  const bEl = document.getElementById("b");
  const cEl = document.getElementById("c");
  const dEl = document.getElementById("d");

  const popEl = document.getElementById("pop");
  const genEl = document.getElementById("gen");
  const seedEl = document.getElementById("seed");

  const chartFxCanvas = document.getElementById("chartFx");
  const chartBestCanvas = document.getElementById("chartBest");

  const X_MIN = -10;
  const X_MAX = 53;

  function num(el) {
    return Number(el.value);
  }

  function fmt(x, digits = 6) {
    if (!Number.isFinite(x)) return "—";
    const v = Number(x.toFixed(digits));
    return String(v);
  }

  function fx(a, b, c, d, x) {
    return a + b * x + c * x * x + d * x * x * x;
  }

  function clamp(x, lo, hi) {
    return Math.max(lo, Math.min(hi, x));
  }

  let chartFx = null;
  let chartBest = null;

  function ensureCharts() {
    if (!chartFx) {
      chartFx = new Chart(chartFxCanvas, {
        type: "scatter",
        data: {
          datasets: [
            {
              label: "f(x)",
              showLine: true,
              data: [],
              pointRadius: 0,
              borderWidth: 2,
              tension: 0.1,
            },
            {
              label: "глобальный максимум",
              data: [],
              showLine: false,
              pointRadius: 8,
              pointHoverRadius: 10,
              borderWidth: 2,
            },
            {
              label: "глобальный минимум",
              data: [],
              showLine: false,
              pointRadius: 8,
              pointHoverRadius: 10,
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          parsing: false, // {x,y}
          plugins: {
            legend: { display: true },
            title: { display: true, text: "" }, // выставим при отрисовке
            tooltip: {
              mode: "nearest",
              intersect: false,
              callbacks: {
                label: (ctx) => {
                  const x = ctx.raw?.x;
                  const y = ctx.raw?.y;
                  if (Number.isFinite(x) && Number.isFinite(y)) {
                    return `${ctx.dataset.label}: x=${fmt(x, 6)}, f(x)=${fmt(y, 6)}`;
                  }
                  return ctx.dataset.label;
                },
              },
            },
          },
          interaction: { mode: "nearest", intersect: false },
          scales: {
            x: {
              type: "linear",
              min: X_MIN,
              max: X_MAX,
              title: { display: true, text: "x" },
              ticks: {
                // чтоб не было “растянуто и пусто”
                maxTicksLimit: 9,
              },
            },
            y: {
              title: { display: true, text: "f(x)" },
              ticks: {
                maxTicksLimit: 7,
              },
            },
          },
        },
      });

      // чтобы canvas занимал высоту карточки нормально
      chartFxCanvas.parentElement.style.height = "220px";
    }

    if (!chartBest) {
      chartBest = new Chart(chartBestCanvas, {
        type: "line",
        data: {
          labels: [],
          datasets: [
            { label: "Best MAX f(x)", data: [], pointRadius: 0, borderWidth: 2, yAxisID: "yMax" },
            { label: "Best MIN f(x)", data: [], pointRadius: 0, borderWidth: 2, yAxisID: "yMin" },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          plugins: {
            legend: { display: true },
            tooltip: { mode: "index", intersect: false },
          },
          interaction: { mode: "index", intersect: false },
          scales: {
            x: { title: { display: true, text: "Поколение" } },
            yMax: { type: "linear", position: "left", title: { display: true, text: "MAX f(x)" } },
            yMin: { type: "linear", position: "right", title: { display: true, text: "MIN f(x)" }, grid: { drawOnChartArea: false } },
          },
        },
      });

      chartBestCanvas.parentElement.style.height = "220px";
    }
  }

  function setBusy(busy) {
    btn.disabled = busy;
    btn.textContent = busy ? "Считаю..." : "Запустить ГА";
  }

  function setStatus(text) {
    statusEl.textContent = text;
  }

  function showResults(data) {
    const maxX = Number(data?.max?.x);
    const maxFx = Number(data?.max?.fx);
    const minX = Number(data?.min?.x);
    const minFx = Number(data?.min?.fx);

    maxOut.textContent = `x = ${fmt(maxX)}; f(x) = ${fmt(maxFx)}`;
    minOut.textContent = `x = ${fmt(minX)}; f(x) = ${fmt(minFx)}`;
  }

  function drawFunctionAndPoints(payload, data) {
    const a = payload.a, b = payload.b, c = payload.c, d = payload.d;

    // линия на всём интервале (как matplotlib)
    const n = 600; // больше точек = “гладко”
    const line = [];
    for (let i = 0; i < n; i++) {
      const x = X_MIN + (i * (X_MAX - X_MIN)) / (n - 1);
      line.push({ x, y: fx(a, b, c, d, x) });
    }

    const maxX = clamp(Number(data?.max?.x), X_MIN, X_MAX);
    const minX = clamp(Number(data?.min?.x), X_MIN, X_MAX);

    const maxY = fx(a, b, c, d, maxX);
    const minY = fx(a, b, c, d, minX);

    // авто-Y по данным + небольшой паддинг
    const ys = line.map(p => p.y);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    const pad = (yMax - yMin) * 0.08 || 1;

    chartFx.options.scales.x.min = X_MIN;
    chartFx.options.scales.x.max = X_MAX;
    chartFx.options.scales.y.min = yMin - pad;
    chartFx.options.scales.y.max = yMax + pad;

    // заголовок как на скрине
    chartFx.options.plugins.title.text =
      `f(x) = ${a} ${b >= 0 ? "+ " : "- "}${Math.abs(b)}x ` +
      `${c >= 0 ? "+ " : "- "}${Math.abs(c)}x² ` +
      `${d >= 0 ? "+ " : "- "}${Math.abs(d)}x³ на [${X_MIN}; ${X_MAX}]`;

    chartFx.data.datasets[0].data = line;
    chartFx.data.datasets[1].data = [{ x: maxX, y: maxY }];
    chartFx.data.datasets[2].data = [{ x: minX, y: minY }];

    chartFx.update();
  }

  function drawHistory(data) {
    const hMax = data?.max?.history?.best_fx ?? [];
    const hMin = data?.min?.history?.best_fx ?? [];
    const n = Math.max(hMax.length, hMin.length);
    const labels = Array.from({ length: n }, (_, i) => i + 1);

    chartBest.data.labels = labels;
    chartBest.data.datasets[0].data = hMax;
    chartBest.data.datasets[1].data = hMin;
    chartBest.update();
  }

  async function run() {
    const payload = {
      a: num(aEl),
      b: num(bEl),
      c: num(cEl),
      d: num(dEl),
      x_min: X_MIN,
      x_max: X_MAX,
      pop_size: num(popEl),
      generations: num(genEl),
      seed: num(seedEl),
    };

    ensureCharts();
    setBusy(true);
    setStatus("Отправляю запрос на сервер...");

    try {
      const res = await fetch("./ga_run.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }

      const data = await res.json();

      setStatus("Готово");
      showResults(data);
      drawHistory(data);
      drawFunctionAndPoints(payload, data);
    } catch (e) {
      console.error(e);
      setStatus("Ошибка (открой Console / Network)");
    } finally {
      setBusy(false);
    }
  }

  btn.addEventListener("click", run);
})();
