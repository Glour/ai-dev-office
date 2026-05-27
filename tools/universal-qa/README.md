# Universal QA Agent

Универсальный browser-first QA-агент для проверки сайтов и web-продуктов перед сдачей.

Он открывает реальный сайт в Chromium, проходит страницы по JSON-чеклисту, делает скриншоты, проверяет UI/UX и собирает отчет `PASS/WARN/FAIL`.

## Пути в AI Dev Office

Папка агента:

```text
tools/universal-qa
```

Главный запуск:

```text
tools/universal-qa/bin/universal-qa.mjs
```

Захват авторизованной браузерной сессии:

```text
tools/universal-qa/bin/capture-session.mjs
```

Ядро раннера:

```text
tools/universal-qa/src/runner.mjs
```

Пример универсального конфига:

```text
tools/universal-qa/configs/example-site.json
```

Отчеты:

```text
tools/universal-qa/artifacts
```

## Установка

```bash
cd tools/universal-qa
npm install
npx playwright install chromium
```

Если в проекте уже есть `@playwright/test`, можно запускать без отдельной установки из окружения проекта, но для переносимости лучше установить зависимости внутри этой папки.

## Запуск

Универсальный пример:

```bash
cd tools/universal-qa
npm run qa -- ./configs/example-site.json
```

С другим сайтом:

```bash
node ./bin/universal-qa.mjs ./configs/my-site.json --base-url https://example.com
```

Видимый браузер:

```bash
node ./bin/universal-qa.mjs ./configs/my-site.json --headed
```

Не падать с exit code `1` при FAIL:

```bash
node ./bin/universal-qa.mjs ./configs/my-site.json --no-strict
```

## Авторизация

Через storage state:

```bash
QA_STORAGE_STATE=/absolute/path/storage-state.json node ./bin/universal-qa.mjs ./configs/my-site.json
```

Создать/обновить storage state через видимый браузер:

```bash
cd tools/universal-qa
npm run capture-session -- --url https://example.com --out ./artifacts/storage-state.json
```

Откроется браузер. Войти вручную, затем нажать Enter в терминале - файл сессии обновится.

Через session cookie:

```bash
QA_SESSION_COOKIE_NAME=session_name QA_SESSION_COOKIE='cookie_value' node ./bin/universal-qa.mjs ./configs/my-site.json
```

Через форму логина:

```bash
QA_USERNAME='user' QA_PASSWORD='password' node ./bin/universal-qa.mjs ./configs/my-site.json
```

В конфиге для этого должны быть указаны селекторы:

```json
{
  "auth": {
    "login": {
      "urlPattern": "/login",
      "usernameSelector": "input[name=\"email\"]",
      "passwordSelector": "input[name=\"password\"]",
      "submitSelector": "button[type=\"submit\"]"
    }
  }
}
```

## Встроенные проверки

Посмотреть список:

```bash
npm run list-checks
```

Основные проверки:

- `expected-text` - обязательный текст на странице.
- `forbidden-text` - запрещенные raw/технические значения.
- `console-clean` - нет `console.error`.
- `pageerror-clean` - нет JS page errors.
- `no-page-overflow` - нет горизонтального overflow.
- `no-visible-overlap` - видимые контролы не налезают друг на друга.
- `form-controls-visible` - кнопки/поля/табы нормального размера.
- `inputs-have-labels` - поля имеют доступное название.
- `buttons-have-names` - кнопки/ссылки не безымянные.
- `textarea-resizable` - textarea можно растягивать.
- `broken-images` - нет битых картинок.
- `info-tooltips` - подсказки появляются, не обрезаются и лежат верхним слоем.
- `tabs-open` - вкладки из списка открываются.
- `actions-work` - клики/fill/select/hover/wait из чеклиста выполняются.
- `selects-readable` - выпадающие списки не выглядят явно обрезанными.
- `table-has-rows` - таблица содержит строки.
- `custom-text-regex` - кастомные regex-проверки текста.
- `http-status-ok` - основной переход открылся с ожидаемым HTTP-статусом.
- `network-clean` - нет failed requests и неожиданных 4xx/5xx в ресурсах/API.
- `basic-seo` - title, description/canonical/noindex по заданной строгости.
- `landmarks` - есть `main` и один видимый `h1`.
- `aria-smoke` - нет дублей `id`, битых `aria-*` ссылок, картинок без `alt`.
- `clickables-enabled` - видимые кликабельные элементы не отключены.
- `focus-visible` - интерактивные элементы имеют заметный focus state.
- `links-valid` - видимые ссылки из выборки не ведут на 4xx/5xx.
- `performance-budget` - страница укладывается в бюджет загрузки/веса/ресурсов.

## Структура конфига

```json
{
  "name": "Project QA",
  "baseUrl": "https://site.com",
  "artifactDir": "../artifacts/project",
  "viewports": [
    { "name": "desktop", "width": 1440, "height": 900 }
  ],
  "defaultChecks": ["expected-text", "console-clean", "no-page-overflow"],
  "globalForbiddenText": ["TODO", "undefined"],
  "pages": [
    {
      "id": "home",
      "title": "Home",
      "path": "/",
      "expectedText": ["Главная"],
      "forbiddenText": ["debug"],
      "checks": ["info-tooltips", "no-visible-overlap"],
      "actions": [
        { "type": "click", "selector": "[data-testid=\"open\"]" },
        { "type": "wait-for-text", "text": "Открыто" },
        { "type": "expect-url", "pattern": "/opened" },
        { "type": "expect-count", "selector": "[data-testid=\"item\"]", "min": 1 }
      ]
    }
  ],
  "apiProofs": [
    {
      "name": "health endpoint",
      "method": "GET",
      "path": "/api/health",
      "allowedStatus": [200],
      "jsonPath": "ok",
      "expectedValue": true,
      "maxMs": 1500
    }
  ]
}
```

## Профили строгости

Для универсального smoke-прохода обычно достаточно:

```json
{
  "defaultChecks": ["expected-text", "http-status-ok", "network-clean", "console-clean", "pageerror-clean", "broken-images"]
}
```

Для приемки перед сдачей добавляй:

```json
{
  "defaultChecks": [
    "expected-text",
    "forbidden-text",
    "http-status-ok",
    "network-clean",
    "console-clean",
    "pageerror-clean",
    "no-page-overflow",
    "no-visible-overlap",
    "form-controls-visible",
    "buttons-have-names",
    "inputs-have-labels",
    "basic-seo",
    "landmarks",
    "aria-smoke",
    "links-valid",
    "performance-budget"
  ]
}
```

## API proofs

`apiProofs` дергают HTTP endpoints отдельно от браузерного сценария. Это удобно для healthcheck, auth/API smoke и проверки backend-контрактов:

```json
{
  "apiProofs": [
    {
      "name": "catalog API",
      "method": "GET",
      "path": "/api/catalog",
      "allowedStatus": [200],
      "jsonPath": "items",
      "exists": true,
      "maxMs": 2000
    }
  ]
}
```

Поддерживаются `headers`, `body`, `expectedText`, `forbiddenText`, `jsonPath`, `expectedValue`, `exists`, `allowedStatus`, `maxMs`, `warnOnly`.

## Расширенные actions/assertions

Сценарии поддерживают действия `click`, `fill`, `select`, `hover`, `press`, `check`, `uncheck`, `clear`, `scroll`, `open-tab`, `wait`, `wait-for-text`, `wait-for-selector`.

Для проверок внутри сценария доступны `expect-text`, `expect-no-text`, `expect-url`, `expect-count`.

## Command proofs

Можно добавить проверку backend/репозитория/серверного состояния:

```json
{
  "commandProofs": [
    {
      "name": "no debug markers",
      "command": "rg",
      "args": ["-n", "console.log|debugger", "apps/web/app"],
      "warnOnly": true
    }
  ]
}
```

Для SSH:

```json
{
  "commandProofs": [
    {
      "name": "production grep",
      "command": "ssh",
      "args": ["root@78.17.16.222", "cd /root/ai-office && rg -n 'pattern' apps/web/app || true"]
    }
  ]
}
```

## Отчет

После запуска создаются:

```text
report.md
report.json
screenshots/*.png
```

Пример:

```text
/Users/alex/PycharmProjects/universal-qa-agent/artifacts/xone-prod/<timestamp>/report.md
```

## Как переносить в другую сессию Codex

Скопировать всю папку:

```text
/Users/alex/PycharmProjects/universal-qa-agent
```

В новой сессии:

```bash
cd /path/to/universal-qa-agent
npm install
npx playwright install chromium
node ./bin/universal-qa.mjs ./configs/example-site.json --base-url https://нужный-сайт.ru
```

Перед сдачей задачи:

1. Обновить JSON-конфиг под замечания заказчика.
2. Запустить QA.
3. Исправлять продукт, пока отчет не будет без `FAIL`.
4. Отправлять заказчику только после чистого отчета и просмотра скриншотов.
