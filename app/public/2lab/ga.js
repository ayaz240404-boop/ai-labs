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

  function num(el) {
    return Number(el.value);
  }

  function fmt(x, digits = 6) {
    if (!Number.isFinite(x)) return "—";
    const v = Number(x.toFixed(digits)); // убирает -0.000000
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
    // --- f(x) + точки max/min ---
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
            },
            {
              label: "MAX точка",
              data: [],
              showLine: false,
              pointRadius: 6,
            },
            {
              label: "MIN точка",
              data: [],
              showLine: false,
              pointRadius: 6,
            },
          ],
        },
        options: {
          responsive: true,
          animation: false,
          parsing: false, // {x,y}
          scales: {
            x: {
              type: "linear",
              min: -10,
              max: 53,
              title: { display: true, text: "x" },
            },
            y: {
              title: { display: true, text: "f(x)" },
            },
          },
          plugins: {
            legend: { display: true },
            tooltip: { mode: "nearest", intersect: false },
          },
        },
      });
    }

    // --- история (две оси Y, иначе всё “плоское”) ---
    if (!chartBest) {
      chartBest = new Chart(chartBestCanvas, {
        type: "line",
        data: {
          labels: [],
          datasets: [
            {
              label: "Best MAX f(x)",
              data: [],
              pointRadius: 0,
              borderWidth: 2,
              yAxisID: "yMax",
            },
            {
              label: "Best MIN f(x)",
              data: [],
              pointRadius: 0,
              borderWidth: 2,
              yAxisID: "yMin",
            },
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
            yMax: {
              type: "linear",
              position: "left",
              title: { display: true, text: "MAX f(x)" },
            },
            yMin: {
              type: "linear",
              position: "right",
              title: { display: true, text: "MIN f(x)" },
              grid: { drawOnChartArea: false },
            },
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

  function drawFunctionAndPoints(payload, data) {
    const a = payload.a,
      b = payload.b,
      c = payload.c,
      d = payload.d;

    const X_MIN = -10;
    const X_MAX = 53;

    // line: 400 точек
    const n = 400;
    const line = [];
    for (let i = 0; i < n; i++) {
      const x = X_MIN + (i * (X_MAX - X_MIN)) / (n - 1);
      line.push({ x, y: fx(a, b, c, d, x) });
    }

    const maxX = clamp(Number(data?.max?.x), X_MIN, X_MAX);
    const minX = clamp(Number(data?.min?.x), X_MIN, X_MAX);

    const maxY = fx(a, b, c, d, maxX);
    const minY = fx(a, b, c, d, minX);

    chartFx.data.datasets[0].data = line;
    chartFx.data.datasets[1].data = [{ x: maxX, y: maxY }];
    chartFx.data.datasets[2].data = [{ x: minX, y: minY }];

    // фикс X
    chartFx.options.scales.x.min = X_MIN;
    chartFx.options.scales.x.max = X_MAX;

    // авто-Y с небольшим “паддингом”
    const ys = line.map((p) => p.y);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    const pad = (yMax - yMin) * 0.08 || 1;
    chartFx.options.scales.y.min = yMin - pad;
    chartFx.options.scales.y.max = yMax + pad;

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
      x_min: -10,
      x_max: 53,
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

      setStatus("Готово ✅");
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
