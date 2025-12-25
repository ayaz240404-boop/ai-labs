(() => {
  const chat = document.getElementById("chat");
  const form = document.getElementById("form");
  const msgInput = document.getElementById("msg");
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

  // play | learn
  let mode = "play";
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

  function setQuickEnabled(enabled) {
    quickBtns.forEach(b => (b.disabled = !enabled));
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

  // ---------------- base helpers ----------------
  async function loadBase() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      } catch {}
    }
    const res = await fetch("/base.json", { cache: "no-store" });
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
      addMsg("Ошибка базы: текущий индекс вне диапазона. Команда: «сброс».");
      return;
    }
    const node = base[currentIndex];
    if (isQuestion(node)) addMsg(node.text);
    else if (isAnswer(node)) addMsg(`Это ${node.text}?`);
    else addMsg("Ошибка базы: неизвестный тип узла. Команда: «сброс».");
  }

  function startNewGame() {
    chat.innerHTML = "";
    mode = "play";
    currentIndex = 0;
    trace = [];
    oldAnswerText = "";
    showLearn(false);
    setQuickEnabled(true);

    addMsg("Начнём новую игру. Загадайте явление природы и отвечайте «Да/Нет».");
    askCurrent();
  }

  // ---------------- gameplay ----------------
  function step(answerYes) {
    if (mode !== "play") return;

    addMsg(answerYes ? "Да" : "Нет", "user");

    const node = base[currentIndex];
    if (!node) {
      addMsg("Ошибка базы: узел не найден. Команда: «сброс».");
      return;
    }

    if (isQuestion(node)) {
      trace.push({ qText: node.text, answer: answerYes ? "Да" : "Нет" });
      const next = answerYes ? node.yes : node.no;

      if (!validIndex(next)) {
        addMsg("Ошибка базы: ветка ведёт в никуда. Команда: «сброс» или исправьте base.json.");
        return;
      }
      currentIndex = next;
      askCurrent();
      return;
    }

    if (isAnswer(node)) {
      if (answerYes) {
        addMsg(`Ура! Я угадал: ${node.text} 😎`);
        setQuickEnabled(false);
        return;
      }

      // проигрыш -> обучение
      oldAnswerText = node.text;
      mode = "learn";
      setQuickEnabled(false);
      showLearn(true);

      addMsg("Сдаюсь 😅 Заполните блок «Обучение» ниже, и я запомню новое явление.");
      return;
    }

    addMsg("Ошибка базы: некорректный узел. Команда: «сброс».");
  }

  // ---------------- commands ----------------
  async function resetToDefault() {
    localStorage.removeItem(STORAGE_KEY);
    base = await loadBase();
    normalizeIds();
    addMsg("База сброшена к исходной (base.json).");
    startNewGame();
  }

  function showWhy() {
    if (!trace.length) {
      addMsg("Пока нет цепочки вопросов (мы в самом начале).");
      return;
    }
    addMsg("Почему я так думаю:");
    trace.forEach(s => addMsg(`• ${s.qText} → ${s.answer}`));
  }

  function showBase() {
    addMsg("Текущая база (JSON):");
    addMsg(JSON.stringify(base, null, 2));
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

    // текущий узел — лист (ответ), на котором мы проиграли
    const oldLeafIndex = currentIndex;
    const oldLeaf = base[oldLeafIndex];

    if (!oldLeaf || !isAnswer(oldLeaf)) {
      addMsg("Ошибка обучения: текущий узел не является ответом. Команда: «сначала».");
      startNewGame();
      return;
    }

    const oldText = oldLeaf.text;

    // 1) создаём новый лист (новое явление)
    const newLeafIndex = base.length;
    base.push({ id: newLeafIndex, kind: "a", text: newA });

    // 2) создаём лист со старым ответом (потому что текущий индекс станет вопросом)
    const oldAnswerLeafIndex = base.length;
    base.push({ id: oldAnswerLeafIndex, kind: "a", text: oldText });

    // 3) превращаем текущий лист в вопрос и ставим ветки
    base[oldLeafIndex] = {
      id: oldLeafIndex,
      kind: "q",
      text: newQ,
      yes: correctIsYes ? newLeafIndex : oldAnswerLeafIndex,
      no:  correctIsYes ? oldAnswerLeafIndex : newLeafIndex
    };

    normalizeIds();
    saveBase();

    addMsg("Готово! Я запомнил новое правило (сохранено в вашем браузере).");
    startNewGame();
  }

  // ---------------- input router ----------------
  function handleText(raw) {
    const text = (raw ?? "").trim();
    if (!text) return;

    const low = text.toLowerCase();

    if (low === "да") return step(true);
    if (low === "нет") return step(false);
    if (low === "почему") return showWhy();
    if (low === "база") return showBase();
    if (low === "сначала") return startNewGame();
    if (low === "сброс") return resetToDefault();

    addMsg(text, "user");
    addMsg("Я понимаю: Да/Нет/почему/база/сначала/сброс.");
  }

  // ---------------- init ----------------
  async function init() {
    base = await loadBase();
    if (!Array.isArray(base) || !base.length) base = [{ id: 0, kind: "a", text: "Дождь" }];
    normalizeIds();

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const t = msgInput.value;
      msgInput.value = "";
      handleText(t);
    });

    quickBtns.forEach(btn => {
      btn.addEventListener("click", () => handleText(btn.dataset.q));
    });

    learnSave.addEventListener("click", applyLearning);
    learnCancel.addEventListener("click", () => {
      addMsg("Обучение отменено.");
      startNewGame();
    });

    startNewGame();
  }

  init();
})();
