<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Лаба 1 — Угадай явление природы</title>
  <link rel="stylesheet" href="/style.css" />
</head>
<body>
  <div class="wrap">
    <header class="top">
      <div>
        <div class="title">Лаба 1 — «Угадай явление природы»</div>
        <div class="subtitle">Отвечай «Да/Нет». Команды: <b>почему</b>, <b>база</b>, <b>сначала</b>, <b>сброс</b>.</div>
      </div>
      <nav class="nav">
        <a href="/">На главную</a>
      </nav>
    </header>

    <main class="chat" id="chat"></main>

    <footer class="bottom">
      <form id="form" autocomplete="off">
        <input id="msg" placeholder="Введите сообщение..." />
        <button type="submit">Отправить</button>
      </form>
      <div class="quick">
        <button class="qbtn" data-q="Да">Да</button>
        <button class="qbtn" data-q="Нет">Нет</button>
        <button class="qbtn" data-q="почему">почему</button>
        <button class="qbtn" data-q="база">база</button>
        <button class="qbtn" data-q="сначала">сначала</button>
        <button class="qbtn" data-q="сброс">сброс</button>
        <label><input type="radio" name="correct" id="correctYes"> Для нового явления ответ: Да</label>
        <label><input type="radio" name="correct" id="correctNo"> Для нового явления ответ: Нет</label>
      </div>
    </footer>
  </div>

  <script src="/lab1/app.js"></script>
</body>
</html>
