function Game() {
  const messenger = document.getElementById("messenger-field");
  const yesButton = document.getElementById("yesButton");
  const noButton = document.getElementById("noButton");

  const addNewRuleSection = document.getElementById("addNewRuleSection");
  const addButton = document.getElementById("addButton");
  const newAnswer = document.getElementById("newAnswer");
  const newQuestion = document.getElementById("newQuestion");
  const correctYes = document.getElementById("correctYes");
  const correctNo = document.getElementById("correctNo");   
  const restartButton = document.getElementById("restartButton");

  let jsonData = [];
  let currentIndex = 0;

  let mode = "play";
  let oldAnswerText = "";

  async function getKnowledgeBase() {
    const saved = localStorage.getItem("KnowledgeBaseNature");
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    const res = await fetch("/lab1/base.json", { cache: "no-store" });
    return await res.json();
  }

  function setKnowledgeBase() {
    localStorage.setItem("KnowledgeBaseNature", JSON.stringify(jsonData));
  }

  function clearAll() { messenger.innerHTML = ""; }

  function printMessage(text, user = "PC") {
    const row = document.createElement("div");
    row.classList.add("message-div");
    if (user === "Вы") row.classList.add("message-div-right");

    const bubble = document.createElement("div");
    bubble.classList.add("message");

    const divUser = document.createElement("div");
    divUser.classList.add("message-user");
    divUser.innerHTML = user;
    if (user === "Вы") divUser.classList.add("message-user-right");

    const divText = document.createElement("div");
    divText.classList.add("message-text");
    divText.innerHTML = text;

    bubble.append(divUser, divText);
    row.append(bubble);
    messenger.append(row);
    messenger.scrollTop = messenger.scrollHeight;
  }

  function isLeaf(i) {
    return jsonData[i].kind === "a";
  }

  function askCurrent() {
    const node = jsonData[currentIndex];
    if (node.kind === "q") {
      printMessage(node.text);
    } else {
      printMessage("Это " + node.text + "?");
    }
  }

  function Yes() {
    if (mode !== "play") return;
    printMessage("ДА", "Вы");

    const node = jsonData[currentIndex];
    if (node.kind === "q") {
      const next = node.yes;
      if (next >= 0) {
        currentIndex = next;
        askCurrent();
      } else {
        printMessage("В базе ошибка: у вопроса нет ветки YES.");
      }
      return;
    }

    printMessage("Ура!!! Я угадал: " + node.text + " 😎");
    yesButton.disabled = noButton.disabled = true;
  }

  function No() {
    if (mode !== "play") return;
    printMessage("НЕТ", "Вы");

    const node = jsonData[currentIndex];
    if (node.kind === "q") {
      const next = node.no;
      if (next >= 0) {
        currentIndex = next;
        askCurrent();
      } else {
        printMessage("В базе ошибка: у вопроса нет ветки NO.");
      }
      return;
    }

    oldAnswerText = node.text;
    printMessage("Сдаюсь 😅 Какое явление вы загадали?");
    yesButton.disabled = noButton.disabled = true;
    addNewRuleSection.style.display = "block";
    mode = "learn";
  }

  function Add() {
    if (mode !== "learn") return;

    const answer = newAnswer.value.trim();
    const question = newQuestion.value.trim();

    if (!answer || !question) {
      printMessage("Нужно ввести явление и уточняющий вопрос!");
      return;
    }

    const correctIsYes = correctYes.checked;
    if (!correctYes.checked && !correctNo.checked) {
      printMessage("Выберите, какой ответ (Да/Нет) верный для нового явления.");
      return;
    }

    const oldLeafId = jsonData.length;
    jsonData.push({ id: oldLeafId, kind: "a", text: oldAnswerText, yes: -1, no: -1 });

    const newLeafId = jsonData.length;
    jsonData.push({ id: newLeafId, kind: "a", text: answer, yes: -1, no: -1 });

    jsonData[currentIndex].kind = "q";
    jsonData[currentIndex].text = question;

    jsonData[currentIndex].yes = correctIsYes ? newLeafId : oldLeafId;
    jsonData[currentIndex].no  = correctIsYes ? oldLeafId : newLeafId;

    setKnowledgeBase();
    printMessage("Спасибо! Я запомнил это (в вашем браузере).");

    newGame();
  }

  function newGame() {
    clearAll();
    mode = "play";
    addNewRuleSection.style.display = "none";
    yesButton.disabled = noButton.disabled = false;
    newAnswer.value = "";
    newQuestion.value = "";
    correctYes.checked = false;
    correctNo.checked = false;

    printMessage("Начнём новую игру. Загадайте явление природы, отвечайте Да/Нет.");
    currentIndex = 0;
    askCurrent();
  }

  async function init() {
    yesButton.addEventListener("click", Yes);
    noButton.addEventListener("click", No);
    addButton.addEventListener("click", Add);
    restartButton.addEventListener("click", newGame);

    jsonData = await getKnowledgeBase();
    newGame();
  }

  init();
}
