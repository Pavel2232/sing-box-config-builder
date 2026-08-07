from __future__ import annotations

import base64
import contextlib
import http.client
import importlib.util
import io
import json
import socket
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from unittest import mock


PROJECT_ROOT = Path(__file__).resolve().parents[2]
MODULE_PATH = PROJECT_ROOT / "sing-box-config-builder.py"
SPEC = importlib.util.spec_from_file_location("sing_box_config_builder", MODULE_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError("Не удалось загрузить sing-box-config-builder.py")
builder = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = builder
SPEC.loader.exec_module(builder)


PUBLIC_ADDRINFO = [
    (
        socket.AF_INET,
        socket.SOCK_STREAM,
        socket.IPPROTO_TCP,
        "",
        ("93.184.216.34", 0),
    )
]


class FakeHeaders(dict[str, str]):
    def get_content_charset(self) -> str | None:
        content_type = self.get("Content-Type", "")
        marker = "charset="
        return content_type.split(marker, 1)[1] if marker in content_type else None


class FakeResponse:
    def __init__(
        self,
        chunks: list[bytes],
        *,
        headers: dict[str, str] | None = None,
        final_url: str = "https://example.com/final",
    ) -> None:
        self.chunks = list(chunks)
        self.headers = FakeHeaders(headers or {})
        self.final_url = final_url

    def __enter__(self) -> "FakeResponse":
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def read(self, _: int = -1) -> bytes:
        return self.chunks.pop(0) if self.chunks else b""

    def geturl(self) -> str:
        return self.final_url


class FakeOpener:
    def __init__(self, response: FakeResponse) -> None:
        self.response = response
        self.request: urllib.request.Request | None = None
        self.timeout: float | None = None

    def open(
        self,
        request: urllib.request.Request,
        timeout: float,
    ) -> FakeResponse:
        self.request = request
        self.timeout = timeout
        return self.response


class HostValidationTests(unittest.TestCase):
    def test_public_host_is_allowed(self) -> None:
        with mock.patch.object(
            builder.socket,
            "getaddrinfo",
            return_value=PUBLIC_ADDRINFO,
        ):
            self.assertTrue(builder.is_public_host("example.com"))

    def test_private_host_is_rejected(self) -> None:
        private = [
            (
                socket.AF_INET,
                socket.SOCK_STREAM,
                socket.IPPROTO_TCP,
                "",
                ("192.168.1.1", 0),
            )
        ]
        with mock.patch.object(builder.socket, "getaddrinfo", return_value=private):
            self.assertFalse(builder.is_public_host("router.local"))

    def test_dns_lookup_retries_before_success(self) -> None:
        with mock.patch.object(
            builder.socket,
            "getaddrinfo",
            side_effect=[socket.gaierror("temporary"), PUBLIC_ADDRINFO],
        ) as getaddrinfo, mock.patch.object(builder.time, "sleep") as sleep:
            self.assertTrue(builder.is_public_host("example.com"))
        self.assertEqual(getaddrinfo.call_count, 2)
        sleep.assert_called_once_with(builder.DNS_RETRY_DELAY_SECONDS)

    def test_dns_failure_has_clear_error(self) -> None:
        with mock.patch.object(
            builder.socket,
            "getaddrinfo",
            side_effect=socket.gaierror("no dns"),
        ), mock.patch.object(builder.time, "sleep"):
            with self.assertRaisesRegex(ValueError, "Не удалось разрешить домен"):
                builder.is_public_host("missing.example")

    def test_empty_dns_result_is_rejected(self) -> None:
        with mock.patch.object(builder.socket, "getaddrinfo", return_value=[]):
            with self.assertRaisesRegex(ValueError, "не вернул ни одного IP"):
                builder.is_public_host("empty.example")

    def test_remote_url_accepts_http_and_https(self) -> None:
        with mock.patch.object(builder, "is_public_host", return_value=True):
            self.assertEqual(
                builder.validate_remote_url("https://example.com/sub").hostname,
                "example.com",
            )
            self.assertEqual(
                builder.validate_remote_url("http://example.com/sub").scheme,
                "http",
            )

    def test_remote_url_rejects_unsafe_variants(self) -> None:
        cases = [
            ("file:///tmp/sub", "только http"),
            ("https:///missing-host", "отсутствует домен"),
            ("https://user:pass@example.com/sub", "Логин и пароль"),
        ]
        for url, message in cases:
            with self.subTest(url=url), self.assertRaisesRegex(ValueError, message):
                builder.validate_remote_url(url)

        with mock.patch.object(builder, "is_public_host", return_value=False):
            with self.assertRaisesRegex(ValueError, "локальный или служебный"):
                builder.validate_remote_url("https://router.example/sub")

    def test_redirects_are_revalidated(self) -> None:
        sentinel = object()
        with mock.patch.object(builder, "validate_remote_url") as validate, mock.patch(
            "urllib.request.HTTPRedirectHandler.redirect_request",
            return_value=sentinel,
        ):
            result = builder.SafeRedirectHandler().redirect_request(
                mock.sentinel.request,
                mock.sentinel.response,
                302,
                "Found",
                {},
                "https://redirect.example/sub",
            )
        validate.assert_called_once_with("https://redirect.example/sub")
        self.assertIs(result, sentinel)


class HappTests(unittest.TestCase):
    def test_hwid_file_is_required_and_validated(self) -> None:
        with mock.patch.object(builder, "HAPP_HWID_FILE", ""):
            with self.assertRaisesRegex(ValueError, "не настроен"):
                builder.load_happ_hwid()

        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "hwid"
            path.write_text("invalid hwid with spaces", encoding="utf-8")
            with mock.patch.object(builder, "HAPP_HWID_FILE", str(path)):
                with self.assertRaisesRegex(ValueError, "неверный формат"):
                    builder.load_happ_hwid()

            path.write_text("HAPP-DEVICE_123456", encoding="utf-8")
            with mock.patch.object(builder, "HAPP_HWID_FILE", str(path)):
                self.assertEqual(builder.load_happ_hwid(), "HAPP-DEVICE_123456")

        with mock.patch.object(builder, "HAPP_HWID_FILE", "/missing/hwid"):
            with self.assertRaisesRegex(ValueError, "не удалось прочитать"):
                builder.load_happ_hwid()

    def test_happ_unsupported_marker_plain_and_base64(self) -> None:
        marker = "Приложение не поддерживается. Обратитесь в поддержку"
        encoded = base64.b64encode(marker.encode()).decode()
        self.assertTrue(builder.contains_happ_unsupported_marker(marker))
        self.assertTrue(builder.contains_happ_unsupported_marker(encoded))
        self.assertFalse(builder.contains_happ_unsupported_marker("vless://node"))


class FetchSubscriptionTests(unittest.TestCase):
    def run_fetch(
        self,
        response: FakeResponse,
        *,
        use_hwid: bool = False,
    ) -> tuple[tuple[str, str], FakeOpener]:
        opener = FakeOpener(response)
        patches = [
            mock.patch.object(builder, "validate_remote_url"),
            mock.patch.object(builder.urllib.request, "build_opener", return_value=opener),
        ]
        if use_hwid:
            patches.append(mock.patch.object(builder, "load_happ_hwid", return_value="HWID-12345678"))
        with patches[0], patches[1]:
            if use_hwid:
                with patches[2]:
                    result = builder.fetch_subscription(
                        "https://example.com/sub",
                        use_hwid=True,
                    )
            else:
                result = builder.fetch_subscription("https://example.com/sub")
        return result, opener

    def test_fetch_returns_text_final_url_and_default_headers(self) -> None:
        response = FakeResponse(
            ["узел".encode("utf-8")],
            headers={"Content-Type": "text/plain; charset=utf-8"},
        )
        result, opener = self.run_fetch(response)
        self.assertEqual(result, ("узел", "https://example.com/final"))
        self.assertEqual(opener.timeout, 35)
        self.assertIsNotNone(opener.request)
        headers = dict(opener.request.header_items())
        self.assertEqual(headers["User-agent"], builder.USER_AGENT)
        self.assertNotIn("X-hwid", headers)

    def test_fetch_adds_happ_headers(self) -> None:
        result, opener = self.run_fetch(
            FakeResponse([b"vless://node"]),
            use_hwid=True,
        )
        self.assertEqual(result[0], "vless://node")
        headers = dict(opener.request.header_items())
        self.assertEqual(headers["User-agent"], builder.HAPP_USER_AGENT)
        self.assertEqual(headers["X-hwid"], "HWID-12345678")
        self.assertEqual(headers["X-device-os"], "macOS")

    def test_fetch_rejects_large_content_length(self) -> None:
        response = FakeResponse(
            [b"small"],
            headers={"Content-Length": str(builder.MAX_SUBSCRIPTION_BYTES + 1)},
        )
        with self.assertRaisesRegex(ValueError, "больше допустимых"):
            self.run_fetch(response)

    def test_fetch_rejects_stream_that_grows_too_large(self) -> None:
        response = FakeResponse([b"123", b"456"])
        with mock.patch.object(builder, "MAX_SUBSCRIPTION_BYTES", 5):
            with self.assertRaisesRegex(ValueError, "больше допустимых"):
                self.run_fetch(response)

    def test_fetch_explains_happ_marker(self) -> None:
        marker = "Приложение не поддерживается"
        with self.assertRaisesRegex(ValueError, "требует HWID"):
            self.run_fetch(FakeResponse([marker.encode()]))
        with self.assertRaisesRegex(ValueError, "отклонил HWID"):
            self.run_fetch(FakeResponse([marker.encode()]), use_hwid=True)


class HttpServerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.temp_dir = tempfile.TemporaryDirectory()
        cls.html_path = Path(cls.temp_dir.name) / "index.html"
        cls.html_path.write_text("<h1>Builder test</h1>", encoding="utf-8")
        cls.en_html_path = Path(cls.temp_dir.name) / "index.en.html"
        cls.en_html_path.write_text("<h1>English builder test</h1>", encoding="utf-8")
        cls.original_html_path = builder.HTML_PATH
        cls.original_en_html_path = builder.EN_HTML_PATH
        cls.original_log_message = builder.BuilderHandler.log_message
        builder.HTML_PATH = cls.html_path
        builder.EN_HTML_PATH = cls.en_html_path
        builder.BuilderHandler.log_message = lambda *args: None
        cls.server = builder.ThreadingHTTPServer(
            ("127.0.0.1", 0),
            builder.BuilderHandler,
        )
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.host, cls.port = cls.server.server_address

    @classmethod
    def tearDownClass(cls) -> None:
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=5)
        builder.HTML_PATH = cls.original_html_path
        builder.EN_HTML_PATH = cls.original_en_html_path
        builder.BuilderHandler.log_message = cls.original_log_message
        cls.temp_dir.cleanup()

    def request(
        self,
        method: str,
        path: str,
        body: bytes | None = None,
        headers: dict[str, str] | None = None,
    ) -> tuple[int, dict[str, str], bytes]:
        connection = http.client.HTTPConnection(self.host, self.port, timeout=5)
        connection.request(method, path, body=body, headers=headers or {})
        response = connection.getresponse()
        data = response.read()
        result = response.status, dict(response.getheaders()), data
        connection.close()
        return result

    def post_json(self, path: str, payload: object) -> tuple[int, dict[str, str], bytes]:
        return self.request(
            "POST",
            path,
            json.dumps(payload).encode(),
            {"Content-Type": "application/json"},
        )

    def test_root_serves_html_with_security_headers(self) -> None:
        status, headers, body = self.request("GET", "/")
        self.assertEqual(status, 200)
        self.assertEqual(body, b"<h1>Builder test</h1>")
        self.assertEqual(headers["Cache-Control"], "no-store")
        self.assertEqual(headers["X-Content-Type-Options"], "nosniff")
        self.assertEqual(headers["Referrer-Policy"], "no-referrer")
        self.assertIn("frame-ancestors 'none'", headers["Content-Security-Policy"])

    def test_english_routes_serve_the_english_html(self) -> None:
        for path in ["/en", "/en/", "/en.html", "/sing-box-config-builder.en.html"]:
            with self.subTest(path=path):
                status, _, body = self.request("GET", path)
                self.assertEqual(status, 200)
                self.assertEqual(body, b"<h1>English builder test</h1>")

    def test_english_error_messages_are_localized(self) -> None:
        self.assertEqual(
            builder.localize_error_message(
                "Разрешены только http:// и https:// ссылки",
                "en",
            ),
            "Only http:// and https:// URLs are allowed",
        )
        status, _, body = self.request(
            "POST",
            "/api/fetch-subscription",
            headers={"Accept-Language": "en"},
        )
        self.assertEqual(status, 400)
        self.assertEqual(json.loads(body)["error"], "Invalid request size")

    def test_health_and_missing_routes(self) -> None:
        status, _, body = self.request("GET", "/api/health")
        self.assertEqual(status, 200)
        self.assertEqual(json.loads(body), {"ok": True})

        status, _, body = self.request("GET", "/missing")
        self.assertEqual(status, 404)
        self.assertFalse(json.loads(body)["ok"])

        status, _, body = self.post_json("/wrong-post", {})
        self.assertEqual(status, 404)
        self.assertFalse(json.loads(body)["ok"])

    def test_fetch_endpoint_returns_subscription(self) -> None:
        with mock.patch.object(
            builder,
            "fetch_subscription",
            return_value=("vless://node", "https://final.example/sub"),
        ) as fetch:
            status, headers, body = self.post_json(
                "/api/fetch-subscription",
                {"url": "https://example.com/sub", "useHwid": True},
            )
        self.assertEqual(status, 200)
        self.assertEqual(headers["Cache-Control"], "no-store")
        self.assertEqual(
            json.loads(body),
            {
                "ok": True,
                "text": "vless://node",
                "finalUrl": "https://final.example/sub",
                "usedHwid": True,
            },
        )
        fetch.assert_called_once_with("https://example.com/sub", use_hwid=True)

    def test_fetch_endpoint_validates_request_body(self) -> None:
        status, _, body = self.request("POST", "/api/fetch-subscription")
        self.assertEqual(status, 400)
        self.assertIn("размер", json.loads(body)["error"])

        status, _, body = self.request(
            "POST",
            "/api/fetch-subscription",
            b"not-json",
            {"Content-Type": "application/json"},
        )
        self.assertEqual(status, 400)
        self.assertTrue(json.loads(body)["error"])

        status, _, body = self.request(
            "POST",
            "/api/fetch-subscription",
            b"x" * (builder.MAX_REQUEST_BYTES + 1),
            {"Content-Type": "application/json"},
        )
        self.assertEqual(status, 400)
        self.assertIn("размер", json.loads(body)["error"])

    def test_fetch_endpoint_maps_upstream_errors(self) -> None:
        cases = [
            (
                urllib.error.HTTPError(
                    "https://example.com/sub",
                    403,
                    "Forbidden",
                    None,
                    None,
                ),
                "HTTP 403",
            ),
            (urllib.error.URLError("network down"), "network down"),
        ]
        for error, message in cases:
            with self.subTest(error=type(error).__name__), mock.patch.object(
                builder,
                "fetch_subscription",
                side_effect=error,
            ):
                status, _, body = self.post_json(
                    "/api/fetch-subscription",
                    {"url": "https://example.com/sub"},
                )
            self.assertEqual(status, 502)
            self.assertIn(message, json.loads(body)["error"])

    def test_missing_html_is_reported(self) -> None:
        missing = Path(self.temp_dir.name) / "missing.html"
        with mock.patch.object(builder, "HTML_PATH", missing):
            status, _, body = self.request("GET", "/index.html")
        self.assertEqual(status, 500)
        self.assertIn("HTML-файл не найден", json.loads(body)["error"])


class CliTests(unittest.TestCase):
    class FakeServer:
        def __init__(self) -> None:
            self.served = False
            self.closed = False

        def serve_forever(self) -> None:
            self.served = True
            raise KeyboardInterrupt

        def server_close(self) -> None:
            self.closed = True

    class ImmediateTimer:
        def __init__(self, delay: float, callback) -> None:
            self.delay = delay
            self.callback = callback

        def start(self) -> None:
            self.callback()

    def test_main_starts_server_opens_browser_and_closes_cleanly(self) -> None:
        server = self.FakeServer()
        output = io.StringIO()
        with mock.patch.object(sys, "argv", [
            "sing-box-config-builder.py",
            "--host",
            "0.0.0.0",
            "--port",
            "9876",
        ]), mock.patch.object(
            builder,
            "ThreadingHTTPServer",
            return_value=server,
        ) as server_factory, mock.patch.object(
            builder.threading,
            "Timer",
            self.ImmediateTimer,
        ), mock.patch.object(
            builder.webbrowser,
            "open",
        ) as open_browser, contextlib.redirect_stdout(output):
            builder.main()

        server_factory.assert_called_once_with(
            ("0.0.0.0", 9876),
            builder.BuilderHandler,
        )
        open_browser.assert_called_once_with("http://127.0.0.1:9876/")
        self.assertTrue(server.served)
        self.assertTrue(server.closed)
        self.assertIn("Для остановки нажмите Ctrl+C", output.getvalue())
        self.assertIn("Остановлено", output.getvalue())

    def test_main_no_open_skips_browser(self) -> None:
        server = self.FakeServer()
        with mock.patch.object(sys, "argv", [
            "sing-box-config-builder.py",
            "--host",
            "127.0.0.1",
            "--port",
            "9877",
            "--no-open",
        ]), mock.patch.object(
            builder,
            "ThreadingHTTPServer",
            return_value=server,
        ), mock.patch.object(
            builder.threading,
            "Timer",
        ) as timer, contextlib.redirect_stdout(io.StringIO()):
            builder.main()

        timer.assert_not_called()
        self.assertTrue(server.served)
        self.assertTrue(server.closed)


if __name__ == "__main__":
    unittest.main()
