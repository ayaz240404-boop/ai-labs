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
        type: "line",
        data: {
          labels: [],
          datasets: [
            { label: "f(x)", data: [] },
            { label: "MAX точка", data: [], showLine: false, pointRadius: 5 },
            { label: "MIN точка", data: [], showLine: false, pointRadius: 5 },
          ],
        },
        options: {
          responsive: true,
          animation: false,
          scales: {
            x: { title: { display: true, text: "x" } },
            y: { title: { display: true, text: "f(x)" } },
          },
          plugins: {
            legend: { display: true },
          },
        },
      });
    }

    if (!chartBest) {
      chartBest = new Chart(chartBestCanvas, {
        type: "line",
        data: {
          labels: [],
          datasets: [
            { label: "Best MAX f(x)", data: [] },
            { label: "Best MIN f(x)", data: [] },
          ],
        },
        options: {
          responsive: true,
          animation: false,
          scales: {
            x: { title: { display: true, text: "Поколение" } },
            y: { title: { display: true, text: "f(x)" } },
          },
          plugins: {
            legend: { display: true },
            tooltip: { mode: "index", intersect: false },
          },
          interaction: { mode: "index", intersect: false },
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
    const maxX = data?.max?.x;
    const maxFx = data?.max?.fx;
    const minX = data?.min?.x;
    const minFx = data?.min?.fx;

    maxOut.textContent = `x = ${fmt(maxX)}; f(x) = ${fmt(maxFx)}`;
    minOut.textContent = `x = ${fmt(minX)}; f(x) = ${fmt(minFx)}`;
  }

  function drawFunctionAndPoints(payload, data) {
    const a = payload.a, b = payload.b, c = payload.c, d = payload.d;

    const X_MIN = -10;
    const X_MAX = 53;

    const n = 300;
    const xs = [];
    const ys = [];

    for (let i = 0; i < n; i++) {
      const x = X_MIN + (i * (X_MAX - X_MIN)) / (n - 1);
      xs.push(x);
      ys.push(fx(a, b, c, d, x));
    }

    const maxX = clamp(Number(data?.max?.x), X_MIN, X_MAX);
    const minX = clamp(Number(data?.min?.x), X_MIN, X_MAX);

    const maxY = fx(a, b, c, d, maxX);
    const minY = fx(a, b, c, d, minX);

    chartFx.data.labels = xs.map(v => Number(v.toFixed(3)));
    chartFx.data.datasets[0].data = ys;

    chartFx.data.datasets[1].data = [{ x: Number(maxX.toFixed(3)), y: maxY }];
    chartFx.data.datasets[2].data = [{ x: Number(minX.toFixed(3)), y: minY }];

    chartFx.options.parsing = false;
    chartFx.options.scales.x.type = "linear";
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
      const res = await fetch("ga_run.php", {
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
