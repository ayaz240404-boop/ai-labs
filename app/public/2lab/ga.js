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

  const chartFxMaxCanvas = document.getElementById("chartFxMax");
  const chartFxMinCanvas = document.getElementById("chartFxMin");
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

  let chartFxMax = null;
  let chartFxMin = null;
  let chartBest = null;

  function makeFxChart(canvas, title) {
    return new Chart(canvas, {
      type: "scatter",
      data: {
        datasets: [
          {
            label: "f(x)",
            showLine: true,
            data: [],
            pointRadius: 0,
            borderWidth: 2,
          },
          {
            label: "точка",
            data: [],
            showLine: false,
            pointRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        animation: false,
        parsing: false,
        plugins: {
          legend: { display: true },
          title: { display: true, text: title },
          tooltip: { mode: "nearest", intersect: false },
        },
        scales: {
          x: { type: "linear", title: { display: true, text: "x" } },
          y: { title: { display: true, text: "f(x)" } },
        },
      },
    });
  }

  function ensureCharts() {
    if (!chartFxMax) chartFxMax = makeFxChart(chartFxMaxCanvas, "Окно максимума");
    if (!chartFxMin) chartFxMin = makeFxChart(chartFxMinCanvas, "Окно минимума");

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

  // строим кусок функции на [x0-w ; x0+w]
  function buildWindowLine(a, b, c, d, xLeft, xRight, points = 250) {
    const line = [];
    for (let i = 0; i < points; i++) {
      const x = xLeft + (i * (xRight - xLeft)) / (points - 1);
      line.push({ x, y: fx(a, b, c, d, x) });
    }
    return line;
  }

  function setAxisNice(chart, line) {
    const ys = line.map((p) => p.y);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    const pad = (yMax - yMin) * 0.12 || 1;
    chart.options.scales.y.min = yMin - pad;
    chart.options.scales.y.max = yMax + pad;
  }

  function drawFunctionAndPoints(payload, data) {
    const a = payload.a, b = payload.b, c = payload.c, d = payload.d;

    const maxX = clamp(Number(data?.max?.x), X_MIN, X_MAX);
    const minX = clamp(Number(data?.min?.x), X_MIN, X_MAX);

    const maxY = fx(a, b, c, d, maxX);
    const minY = fx(a, b, c, d, minX);

    // ширина окна по X (можешь менять)
    const W = 8;

    // -------- окно MAX: показываем ТОЛЬКО окрестность maxX ----------
    {
      const left = clamp(maxX - W, X_MIN, X_MAX);
      const right = clamp(maxX + W, X_MIN, X_MAX);
      const line = buildWindowLine(a, b, c, d, left, right, 250);

      chartFxMax.data.datasets[0].data = line;
      chartFxMax.data.datasets[1].data = [{ x: maxX, y: maxY }];

      chartFxMax.options.scales.x.min = left;
      chartFxMax.options.scales.x.max = right;
      setAxisNice(chartFxMax, line);

      chartFxMax.update();
    }

    // -------- окно MIN: показываем ТОЛЬКО окрестность minX ----------
    {
      const left = clamp(minX - W, X_MIN, X_MAX);
      const right = clamp(minX + W, X_MIN, X_MAX);
      const line = buildWindowLine(a, b, c, d, left, right, 250);

      chartFxMin.data.datasets[0].data = line;
      chartFxMin.data.datasets[1].data = [{ x: minX, y: minY }];

      chartFxMin.options.scales.x.min = left;
      chartFxMin.options.scales.x.max = right;
      setAxisNice(chartFxMin, line);

      chartFxMin.update();
    }
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
