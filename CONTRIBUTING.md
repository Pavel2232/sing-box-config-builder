# Contributing

Thank you for improving Sing-box Config Builder. Small, focused pull requests
are easiest to review and maintain.

## Before you start

- Search existing issues before opening a new one.
- Open an issue first for new protocols, routing behavior, or large UI changes.
- Never post real subscription URLs, UUIDs, passwords, Happ HWIDs, or generated
  configs. Use fictional values and sanitized fixtures.
- Follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Local setup

Requirements:

- Python 3.10 or newer;
- Node.js 18 or newer;
- Docker with Compose for the container check.

```bash
npm ci
npm run build
npm test
```

The project has no runtime Python dependencies. `npm test` runs Python tests,
Node build/integrity checks, and `docker compose config --quiet`.

## Making changes

1. Fork the repository and create a branch from `main`.
2. Edit source files, not generated HTML files.
3. Add or update non-UI tests when behavior changes.
4. Run `npm run build` to regenerate both RU and EN HTML artifacts.
5. Run `npm test` and make sure no secrets appear in the diff.
6. Open a pull request using the repository template.

The source map is documented in [docs/development.md](docs/development.md).
Generated files are:

- `sing-box-config-builder.html`;
- `sing-box-config-builder.en.html`;
- compatible copies inside `sing-box-config-builder-local/`.

## Code and documentation style

- Keep the browser application dependency-free and the Python server based on
  the standard library.
- Preserve SSRF protection, request-size limits, secret handling, and the
  local-only Docker binding.
- Add user-visible strings to `src/i18n.js` in both languages.
- Keep protocol parsing separate from DOM rendering.
- Update both `README.md` and `README.en.md` when public behavior changes.
- Prefer an explicit error over silently accepting an unsafe or unsupported
  configuration.

## Pull request checklist

- The change is focused and explained.
- RU and EN behavior remain consistent.
- Generated artifacts are synchronized.
- `npm test` passes.
- Documentation is updated.
- No subscription secrets or personal identifiers are included.

By contributing, you agree that your contribution is licensed under the
project's [MIT License](LICENSE).

## Кратко по-русски

Перед PR создайте отдельную ветку, меняйте исходники вместо сгенерированных
HTML, добавляйте строки сразу на RU/EN, выполняйте `npm run build` и `npm test`.
Никогда не прикладывайте реальные ссылки подписок, ключи, HWID или готовый
конфиг. Для крупных изменений сначала создайте issue.
