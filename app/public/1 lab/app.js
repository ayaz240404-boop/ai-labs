(() => {
  const chat = document.getElementById("chat");
  const quickBtns = Array.from(document.querySelectorAll(".qbtn"));

  // learn UI
  const learnBox = document.getElementById("learn");
  const learnAnswer = document.getElementById("learnAnswer");
  const learnQuestion = document.getElementById("learnQuestion");
  const learnSave = document.getElementById("learnSave");
  const learnCancel = document.getElementById("learnCancel");
  const correctYes = document.getElementById("correctYes");
  const correctNo = document.getElementById("correctNo");

  const STORAGE_KEY = "KnowledgeBaseNature";

  let base = [];
  let currentIndex = 0;

  // idle | play | learn | done
  let mode = "idle";
  let oldAnswerText = "";
  let trace = []; // { qText, answer }

  // ---------------- UI helpers ----------------
  function addMsg(text, who = "bot") {
    const div = document.createElement("div");
    div.className = `msg ${who === "user" ? "user" : "bot"}`;
    div.textContent = text;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
  }

  function showLearn(show) {
    learnBox.hidden = !show;
    if (show) {
      learnAnswer.value = "";
      learnQuestion.value = "";
      correctYes.checked = false;
      correctNo.checked = false;
      learnAnswer.focus();
    }
  }

  function enableButtons(enabled) {
    // отключаем все qbtn кроме start, когда нужно
    quickBtns.forEach(btn => {
      const cmd = btn.dataset.q;
      if (cmd === "start") btn.disabled = false;      // start всегда доступна
      else btn.disabled = !enabled;
    });
  }

  // ---------------- base helpers ----------------
  async function loadBase() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      } catch {}
    }
    // лучше относительный путь
    const res = await fetch("base.json", { cache: "no-store" });
    return await res.json();
  }

  function saveBase() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(base));
  }

  function normalizeIds() {
    base.forEach((n, i) => (n.id = i));
  }

  function validIndex(i) {
    return Number.isInteger(i) && i >= 0 && i < base.length;
  }

  function isQuestion(n) { return n?.kind === "q"; }
  function isAnswer(n) { return n?.kind === "a"; }

  function askCurrent() {
    if (!validIndex(currentIndex)) {
      addMsg("Ошибка базы: текущий индекс вне диапазона. Нажмите «сброс».");
      mode = "idle";
      enableButtons(false);
      return;
    }

    const node = base[currentIndex];
    if (isQuestion(node)) addMsg(node.text);
    else if (isAnswer(node)) addMsg(`Это ${node.text}?`);
    else addMsg("Ошибка базы: неизвестный тип узла. Нажмите «сброс».");
  }

  // ---------------- game lifecycle ----------------
  function showWelcome() {
    chat.innerHTML = "";
    showLearn(false);
    trace = [];
    currentIndex = 0;
    oldAnswerText = "";
    mode = "idle";

    addMsg("Привет! Я игра «Акинатор: явления природы».");
    addMsg("Нажмите «Начать игру», загадайте явление и отвечайте кнопками «Да/Нет».");
    enableButtons(false);
  }

  function startGame() {
    if (!base.length) return;
    showLearn(false);
    trace = [];
    currentIndex = 0;
    oldAnswerText = "";
    mode = "play";

    addMsg("Ок, начинаем! Загадайте явление природы.");
    enableButtons(true);
    askCurrent();
  }

  // ---------------- gameplay ----------------
  function step(answerYes) {
    if (mode !== "play") return;

    addMsg(answerYes ? "Да" : "Нет", "user");

    const node = base[currentIndex];
    if (!node) {
      addMsg("Ошибка базы: узел не найден. Нажмите «сброс».");
      return;
    }

    if (isQuestion(node)) {
      trace.push({ qText: node.text, answer: answerYes ? "Да" : "Нет" });

      const next = answerYes ? node.yes : node.no;
      if (!validIndex(next)) {
        addMsg("Ошибка базы: ветка ведёт в никуда. Нажмите «сброс».");
        return;
      }

      currentIndex = next;
      askCurrent();
      return;
    }

    if (isAnswer(node)) {
      if (answerYes) {
        addMsg(`Ура! Я угадал: ${node.text}`);
        mode = "done";
        enableButtons(false);
        return;
      }

      // проигрыш -> обучение
      oldAnswerText = node.text;
      mode = "learn";
      enableButtons(false);
      showLearn(true);
      addMsg("Сдаюсь Заполните блок «Обучение» ниже, и я запомню новое явление.");
      return;
    }
  }

  // ---------------- commands ----------------
  function showWhy() {
    if (mode !== "play") return;
    if (!trace.length) {
      addMsg("Пока нет цепочки вопросов (мы в самом начале).");
      return;
    }
    addMsg("Почему я так думаю:");
    trace.forEach(s => addMsg(`• ${s.qText} → ${s.answer}`));
  }

  async function resetToDefault() {
    localStorage.removeItem(STORAGE_KEY);
    base = await loadBase();
    normalizeIds();
    addMsg("База сброшена к исходной (base.json).");
    showWelcome();
  }

  function restart() {
    // “сначала” — новая игра с текущей базой
    addMsg("Ок, начнём сначала.");
    startGame();
  }

  // ---------------- learning ----------------
  function applyLearning() {
    if (mode !== "learn") return;

    const newA = learnAnswer.value.trim();
    const newQ = learnQuestion.value.trim();
    const correctIsYes = correctYes.checked;
    const correctIsNo = correctNo.checked;

    if (!newA || !newQ) {
      addMsg("Нужно заполнить: новое явление и уточняющий вопрос.");
      return;
    }
    if (!correctIsYes && !correctIsNo) {
      addMsg("Выберите, какой ответ (Да/Нет) верный для нового явления.");
      return;
    }

    const oldLeafIndex = currentIndex;
    const oldLeaf = base[oldLeafIndex];

    if (!oldLeaf || !isAnswer(oldLeaf)) {
      addMsg("Ошибка обучения: текущий узел не является ответом. Нажмите «Начать игру».");
      showWelcome();
      return;
    }

    const oldText = oldLeaf.text;

    const newLeafIndex = base.length;
    base.push({ id: newLeafIndex, kind: "a", text: newA });

    const oldAnswerLeafIndex = base.length;
    base.push({ id: oldAnswerLeafIndex, kind: "a", text: oldText });

    base[oldLeafIndex] = {
      id: oldLeafIndex,
      kind: "q",
      text: newQ,
      yes: correctIsYes ? newLeafIndex : oldAnswerLeafIndex,
      no:  correctIsYes ? oldAnswerLeafIndex : newLeafIndex
    };

    normalizeIds();
    saveBase();

    addMsg("Готово! Я запомнил новое правило");
    showLearn(false);
    showWelcome(); // возвращаемся к экрану “Начать игру”
  }

  // ---------------- buttons router ----------------
  function handleCommand(cmd) {
    switch (cmd) {
      case "start":
        return startGame();
      case "Да":
      case "да":
        return step(true);
      case "Нет":
      case "нет":
        return step(false);
      case "почему":
        return showWhy();
      case "сначала":
        return restart();
      case "сброс":
        return resetToDefault();
      default:
        return;
    }
  }

  // ---------------- init ----------------
  async function init() {
    base = await loadBase();
    if (!Array.isArray(base) || !base.length) {
      base = [{ id: 0, kind: "a", text: "Дождь" }];
    }
    normalizeIds();

    quickBtns.forEach(btn => {
      btn.addEventListener("click", () => handleCommand(btn.dataset.q));
    });

    learnSave.addEventListener("click", applyLearning);
    learnCancel.addEventListener("click", () => {
      addMsg("Обучение отменено.");
      showLearn(false);
      showWelcome();
    });

    showWelcome();
  }

  init();
})();
