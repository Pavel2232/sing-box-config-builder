# Разработка

## Источники и артефакты

Редактируются только:

- `sing-box-config-builder.template.html` — HTML-каркас;
- `src/styles.css` — внешний вид;
- `src/parser-normalization.js` — проверка и нормализация полей;
- `src/parser-transports.js` — TLS и транспортные параметры;
- `src/subscription-parser.js` — декодирование и разбор протоколов;
- `src/source-ui.js` — состояние и отображение подписок;
- `src/app.js` — настройки и сборка конфига;
- `data/direct-domains.txt` — DIRECT-домены;
- `sing-box-config-builder.py` — локальный HTTP API.

`npm run build` инлайнит CSS и JavaScript в единый автономный HTML. Команда
также обновляет совместимые копии Python и launcher внутри
`sing-box-config-builder-local/`. Эти копии нужны существующему portable bundle
и проверяются текущими тестами, но Docker использует корневые исходники.

## Сборка

```bash
npm run build
```

Результат:

```text
sing-box-config-builder.html
sing-box-config-builder-local/sing-box-config-builder.html
```

Docker выполняет ту же сборку в отдельном Node-этапе, после чего переносит
только готовый HTML в минимальный Python-образ.

## Проверка

```bash
npm test
ruff check sing-box-config-builder.py tests/python/test_backend.py
```

Существующий набор намеренно не включает UI-тесты. Node-проверки валидируют
сборку, встроенный JSON, Docker-контракт и синхронность совместимых файлов;
Python-проверки покрывают HTTP API, HWID, DNS/SSRF и CLI.

## Архив

Исторические конфиги и старые самостоятельные генераторы не участвуют в
сборке. Они перенесены в соседний каталог
`new-chat-legacy-2026-08-07`, чтобы рабочий проект содержал только актуальные
источники, но данные оставались восстановимыми.
