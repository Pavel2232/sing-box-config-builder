#!/usr/bin/env python3

from __future__ import annotations

import argparse
import base64
import binascii
import ipaddress
import json
import os
import re
import socket
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
HTML_PATH = ROOT / "sing-box-config-builder.html"
MAX_REQUEST_BYTES = 64 * 1024
MAX_SUBSCRIPTION_BYTES = 16 * 1024 * 1024
USER_AGENT = "SingBoxConfigBuilder/1.0"
HAPP_USER_AGENT = "Happ/4.11.0"
HAPP_HWID_FILE = os.environ.get("HAPP_HWID_FILE", "")
HAPP_UNSUPPORTED_MARKER = "приложение не поддерживается"
HWID_PATTERN = re.compile(r"^[A-Za-z0-9._:-]{8,128}$")
DNS_RESOLVE_ATTEMPTS = 3
DNS_RETRY_DELAY_SECONDS = 0.25


def is_public_host(hostname: str) -> bool:
    addresses: set[str] = set()
    last_error: socket.gaierror | None = None
    for attempt in range(DNS_RESOLVE_ATTEMPTS):
        try:
            addresses = {
                item[4][0]
                for item in socket.getaddrinfo(
                    hostname,
                    None,
                    type=socket.SOCK_STREAM,
                )
            }
            last_error = None
            break
        except socket.gaierror as error:
            last_error = error
            if attempt + 1 < DNS_RESOLVE_ATTEMPTS:
                time.sleep(DNS_RETRY_DELAY_SECONDS)

    if last_error is not None:
        raise ValueError(
            f"Не удалось разрешить домен «{hostname}». "
            "Повторите загрузку или проверьте DNS."
        ) from last_error

    if not addresses:
        raise ValueError(
            f"Домен «{hostname}» не вернул ни одного IP-адреса"
        )

    for address in addresses:
        ip = ipaddress.ip_address(address)
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        ):
            return False
    return True


def validate_remote_url(url: str) -> urllib.parse.ParseResult:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in {"http", "https"}:
        raise ValueError("Разрешены только http:// и https:// ссылки")
    if not parsed.hostname:
        raise ValueError("В ссылке отсутствует домен")
    if parsed.username or parsed.password:
        raise ValueError("Логин и пароль внутри URL не поддерживаются")
    if not is_public_host(parsed.hostname):
        raise ValueError(
            f"Домен «{parsed.hostname}» указывает на локальный "
            "или служебный адрес"
        )
    return parsed


class SafeRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(
        self,
        req: urllib.request.Request,
        fp: Any,
        code: int,
        msg: str,
        headers: Any,
        newurl: str,
    ) -> urllib.request.Request | None:
        validate_remote_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def load_happ_hwid() -> str:
    if not HAPP_HWID_FILE:
        raise ValueError(
            "HWID Happ не настроен в Python/Docker сервере"
        )
    try:
        hwid = Path(HAPP_HWID_FILE).read_text(encoding="utf-8").strip()
    except OSError as error:
        raise ValueError("HWID Happ не удалось прочитать") from error
    if not HWID_PATTERN.fullmatch(hwid):
        raise ValueError("HWID Happ имеет неверный формат")
    return hwid


def contains_happ_unsupported_marker(text: str) -> bool:
    candidates = [text]
    compact = "".join(text.split())
    try:
        decoded = base64.b64decode(
            compact + "=" * (-len(compact) % 4),
            validate=True,
        ).decode("utf-8", errors="replace")
        candidates.append(decoded)
    except (binascii.Error, ValueError, UnicodeError):
        pass
    return any(HAPP_UNSUPPORTED_MARKER in value.casefold() for value in candidates)


def fetch_subscription(url: str, use_hwid: bool = False) -> tuple[str, str]:
    validate_remote_url(url)
    opener = urllib.request.build_opener(SafeRedirectHandler())
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/plain, application/json, */*",
        "Cache-Control": "no-cache",
    }
    if use_hwid:
        headers.update(
            {
                "User-Agent": HAPP_USER_AGENT,
                "X-HWID": load_happ_hwid(),
                "X-Device-OS": "macOS",
                "X-Ver-OS": "15.0",
                "X-Device-model": "Mac",
            }
        )
    request = urllib.request.Request(
        url,
        headers=headers,
    )

    with opener.open(request, timeout=35) as response:
        content_length = response.headers.get("Content-Length")
        if content_length and int(content_length) > MAX_SUBSCRIPTION_BYTES:
            raise ValueError("Подписка больше допустимых 16 MiB")

        chunks: list[bytes] = []
        total = 0
        while True:
            chunk = response.read(64 * 1024)
            if not chunk:
                break
            total += len(chunk)
            if total > MAX_SUBSCRIPTION_BYTES:
                raise ValueError("Подписка больше допустимых 16 MiB")
            chunks.append(chunk)

        encoding = response.headers.get_content_charset() or "utf-8"
        text = b"".join(chunks).decode(encoding, errors="replace")
        if contains_happ_unsupported_marker(text):
            if use_hwid:
                raise ValueError(
                    "Провайдер отклонил HWID Happ. Обновите HWID из Happ."
                )
            raise ValueError(
                "Провайдер требует HWID Happ. Включите переключатель «HWID Happ»."
            )
        return text, response.geturl()


class BuilderHandler(BaseHTTPRequestHandler):
    server_version = "SingBoxConfigBuilder/1.0"

    def log_message(self, format: str, *args: Any) -> None:
        print(f"[builder] {self.address_string()} - {format % args}")

    def send_json(self, status: HTTPStatus, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        path = urllib.parse.urlparse(self.path).path
        if path in {"/", "/index.html"}:
            try:
                body = HTML_PATH.read_bytes()
            except FileNotFoundError:
                self.send_json(
                    HTTPStatus.INTERNAL_SERVER_ERROR,
                    {"ok": False, "error": "HTML-файл не найден"},
                )
                return

            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Referrer-Policy", "no-referrer")
            self.send_header(
                "Content-Security-Policy",
                "default-src 'self'; script-src 'self' 'unsafe-inline'; "
                "style-src 'self' 'unsafe-inline'; connect-src 'self'; "
                "img-src 'self' data:; object-src 'none'; base-uri 'none'; "
                "frame-ancestors 'none'",
            )
            self.end_headers()
            self.wfile.write(body)
            return

        if path == "/api/health":
            self.send_json(HTTPStatus.OK, {"ok": True})
            return

        self.send_json(
            HTTPStatus.NOT_FOUND,
            {"ok": False, "error": "Не найдено"},
        )

    def do_POST(self) -> None:
        path = urllib.parse.urlparse(self.path).path
        if path != "/api/fetch-subscription":
            self.send_json(
                HTTPStatus.NOT_FOUND,
                {"ok": False, "error": "Не найдено"},
            )
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            content_length = 0

        if content_length <= 0 or content_length > MAX_REQUEST_BYTES:
            self.send_json(
                HTTPStatus.BAD_REQUEST,
                {"ok": False, "error": "Некорректный размер запроса"},
            )
            return

        try:
            payload = json.loads(self.rfile.read(content_length))
            url = str(payload.get("url", "")).strip()
            use_hwid = payload.get("useHwid") is True
            text, final_url = fetch_subscription(url, use_hwid=use_hwid)
            self.send_json(
                HTTPStatus.OK,
                {
                    "ok": True,
                    "text": text,
                    "finalUrl": final_url,
                    "usedHwid": use_hwid,
                },
            )
        except ValueError as error:
            self.send_json(
                HTTPStatus.BAD_REQUEST,
                {"ok": False, "error": str(error)},
            )
        except urllib.error.HTTPError as error:
            self.send_json(
                HTTPStatus.BAD_GATEWAY,
                {
                    "ok": False,
                    "error": f"Сервер подписки ответил HTTP {error.code}",
                },
            )
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            reason = getattr(error, "reason", error)
            self.send_json(
                HTTPStatus.BAD_GATEWAY,
                {
                    "ok": False,
                    "error": f"Не удалось скачать подписку: {reason}",
                },
            )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Локальный сервер Sing-box Config Builder",
    )
    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="Адрес прослушивания (для Docker используйте 0.0.0.0)",
    )
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument(
        "--no-open",
        action="store_true",
        help="Не открывать браузер автоматически",
    )
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), BuilderHandler)
    display_host = "127.0.0.1" if args.host == "0.0.0.0" else args.host
    url = f"http://{display_host}:{args.port}/"
    print(f"Sing-box Config Builder: {url}")
    print("Для остановки нажмите Ctrl+C.")

    if not args.no_open:
        threading.Timer(0.7, lambda: webbrowser.open(url)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nОстановлено.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
