# Docker

## Запуск

```bash
touch sing-box-config-builder-local/.happ-hwid
docker compose up -d --build
```

Интерфейс доступен только на текущем компьютере:

- страница: `http://127.0.0.1:18765/`;
- английская страница: `http://127.0.0.1:18765/en/`;
- health-check: `http://127.0.0.1:18765/api/health`.

Контейнер использует `restart: unless-stopped`, непривилегированного
пользователя, read-only файловую систему и `no-new-privileges`.

## Управление

```bash
docker compose ps
docker compose logs -f builder
docker compose restart builder
docker compose down
```

После изменения исходников достаточно повторить:

```bash
docker compose up -d --build
```

Docker самостоятельно собирает HTML из `src/`, `data/` и HTML-шаблона.

## Другой порт

```bash
BUILDER_PORT=18766 docker compose up -d --build
```

Либо создайте `.env` рядом с `compose.yaml`:

```dotenv
BUILDER_PORT=18766
```

## HWID Happ

HWID нужен только подпискам, привязанным к приложению Happ. Запишите его одной
строкой в `sing-box-config-builder-local/.happ-hwid` и ограничьте права:

```bash
chmod 600 sing-box-config-builder-local/.happ-hwid
```

Для обычных подписок оставьте файл пустым и не включайте переключатель HWID.
Compose передаёт файл контейнеру как secret, а не как переменную окружения.
