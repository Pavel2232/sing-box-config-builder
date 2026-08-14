FROM node:26-alpine AS web

WORKDIR /src

COPY build-sing-box-config-builder.mjs \
     sing-box-config-builder.template.html \
     sing-box-duckvpn-whitelist-direct-plus-vni-refreshed-2026-07-27.json ./
COPY data ./data
COPY src ./src
RUN mkdir -p sing-box-config-builder-local && node build-sing-box-config-builder.mjs

FROM python:3.13-alpine

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

RUN addgroup -S builder && adduser -S -G builder builder

COPY --chown=builder:builder sing-box-config-builder.py ./
COPY --from=web --chown=builder:builder /src/sing-box-config-builder.html ./
COPY --from=web --chown=builder:builder /src/sing-box-config-builder.en.html ./

USER builder

EXPOSE 8765

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8765/api/health', timeout=3).read()"]

CMD ["python", "sing-box-config-builder.py", "--host", "0.0.0.0", "--port", "8765", "--no-open"]
