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

  const treeBox = document.getElementById("tree");
  const treeBody = document.getElementById("treeBody");
  const treeClose = document.getElementById("treeClose");
  const treeRefresh = document.getElementById("treeRefresh");

  const akiImg = document.getElementById("akiImg");

  const AKI = {
    calm: "/photos/akinator/akinator_dumaet.png",
    angry: "/photos/akinator/akinator_zlitsya.png",
    happy: "/photos/akinator/akinator_raduetsa.png",
  };

  function setAkiMood(mood) {
    if (!akiImg) return;

    const src = AKI[mood] || AKI.calm;
    if (akiImg.getAttribute("src") !== src) {
      akiImg.setAttribute("src", src);
    }

    akiImg.classList.remove("aki-calm", "aki-angry", "aki-happy");
    akiImg.classList.add(`aki-${mood}`);

    akiImg.classList.remove("aki-pop");
    void akiImg.offsetWidth;
    akiImg.classList.add("aki-pop");
  }

  const STORAGE_KEY = "KnowledgeBaseNature";

  let base = [];
  let currentIndex = 0;

  let mode = "idle";
  let oldAnswerText = "";
  let trace = [];

  let noStreak = 0;

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

  function showTree(show) {
    treeBox.hidden = !show;
    if (show) renderTree();
  }

  function enableButtons(enabled) {
    quickBtns.forEach((btn) => {
      const cmd = btn.dataset.q;
      if (cmd === "start") btn.disabled = false;
      else btn.disabled = !enabled;
    });
  }

  async function loadBase() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      } catch {}
    }
    const res = await fetch("./base.json", { cache: "no-store" });
    return await res.json();
  }

  function saveBase() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(base));
  }

  function loadBaseFromStorageOrMemory() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      } catch {}
    }
    return base;
  }

  function normalizeIds() {
    base.forEach((n, i) => (n.id = i));
  }

  function validIndex(i) {
    return Number.isInteger(i) && i >= 0 && i < base.length;
  }

  function isQuestion(n) {
    return n?.kind === "q";
  }
  function isAnswer(n) {
    return n?.kind === "a";
  }

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

  function showWelcome() {
    chat.innerHTML = "";
    showLearn(false);
    showTree(false);
    trace = [];
    currentIndex = 0;
    oldAnswerText = "";
    noStreak = 0;
    mode = "idle";

    setAkiMood("calm");

    addMsg("Привет! Я игра «Акинатор: явления природы».");
    addMsg("Нажмите «Начать игру», загадайте явление и отвечайте кнопками «Да/Нет».");
    enableButtons(false);
  }

  function startGame() {
    if (!base.length) return;

    showLearn(false);
    showTree(false);

    trace = [];
    currentIndex = 0;
    oldAnswerText = "";
    noStreak = 0;
    mode = "play";

    setAkiMood("calm");

    addMsg("Ок, начинаем! Загадайте явление природы.");
    enableButtons(true);
    askCurrent();
  }

  function step(answerYes) {
    if (mode !== "play") return;

    addMsg(answerYes ? "Да" : "Нет", "user");

    if (answerYes) {
      noStreak = 0;
      setAkiMood("calm");
    } else {
      noStreak += 1;
      setAkiMood(noStreak >= 2 ? "angry" : "calm");
    }

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
        setAkiMood("happy");
        mode = "done";
        enableButtons(false);
        return;
      }

      oldAnswerText = node.text;
      mode = "learn";
      enableButtons(false);
      showLearn(true);
      setAkiMood("angry");

      addMsg("Сдаюсь Заполните блок «Обучение» ниже, и я запомню новое явление.");
      return;
    }
  }

  function showWhy() {
    if (mode !== "play") return;
    if (!trace.length) {
      addMsg("Пока нет цепочки вопросов (мы в самом начале).");
      return;
    }
    addMsg("Почему я так думаю:");
    trace.forEach((s) => addMsg(`• ${s.qText} → ${s.answer}`));
  }

  async function resetToDefault() {
    localStorage.removeItem(STORAGE_KEY);
    base = await loadBase();
    normalizeIds();
    addMsg("База сброшена к исходной (base.json).");
    showWelcome();
  }

  function restart() {
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
      no: correctIsYes ? oldAnswerLeafIndex : newLeafIndex,
    };

    normalizeIds();
    saveBase();

    addMsg("Готово! Я запомнил новое правило");
    showLearn(false);

    noStreak = 0;
    setAkiMood("calm");

    if (treeBox && !treeBox.hidden) renderTree();

    showWelcome();
  }

  function renderTree() {
    const b = loadBaseFromStorageOrMemory();
    const seen = new Set();

    function nodeToLines(idx, prefix = "", isLast = true) {
      const lines = [];
      const connector = prefix ? (isLast ? "└─ " : "├─ ") : "";
      const node = b[idx];

      if (!node) {
        lines.push(`${prefix}${connector}[${idx}] <нет узла>`);
        return lines;
      }

      const label =
        node.kind === "q" ? `[${idx}] ? ${node.text}` : `[${idx}] ✓ ${node.text}`;

      lines.push(`${prefix}${connector}${label}`);

      if (node.kind !== "q") return lines;

      if (seen.has(idx)) {
        lines.push(`${prefix}${isLast ? "   " : "│  "}↳ (цикл)`);
        return lines;
      }
      seen.add(idx);

      const nextPrefix = prefix + (prefix ? (isLast ? "   " : "│  ") : "");
      const yesIdx = node.yes;
      const noIdx = node.no;

      lines.push(`${nextPrefix}├─ (Да)`);
      lines.push(...nodeToLines(yesIdx, nextPrefix + "│  ", false));

      lines.push(`${nextPrefix}└─ (Нет)`);
      lines.push(...nodeToLines(noIdx, nextPrefix + "   ", true));

      return lines;
    }

    treeBody.textContent = nodeToLines(0).join("\n");
  }

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
      case "tree":
        return showTree(treeBox.hidden); 
      default:
        return;
    }
  }

  async function init() {
    base = await loadBase();
    if (!Array.isArray(base) || !base.length) {
      base = [{ id: 0, kind: "a", text: "Дождь" }];
    }
    normalizeIds();

    setAkiMood("calm");

    quickBtns.forEach((btn) => {
      btn.addEventListener("click", () => handleCommand(btn.dataset.q));
    });

    learnSave.addEventListener("click", applyLearning);
    learnCancel.addEventListener("click", () => {
      addMsg("Обучение отменено.");
      showLearn(false);
      noStreak = 0;
      setAkiMood("calm");
      showWelcome();
    });

    treeClose.addEventListener("click", () => showTree(false));
    treeRefresh.addEventListener("click", renderTree);

    showWelcome();
  }

  init();
})();
