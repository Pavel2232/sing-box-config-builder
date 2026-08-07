import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";


const projectRoot = path.resolve(import.meta.dirname, "../..");
const read = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");


test("Python runtime copies stay byte-for-byte synchronized", () => {
  assert.equal(
    read("sing-box-config-builder.py"),
    read("sing-box-config-builder-local/sing-box-config-builder.py"),
  );
});


test("Python CLI exposes the documented local-server options", () => {
  const result = spawnSync(
    "python3",
    ["sing-box-config-builder.py", "--help"],
    { cwd: projectRoot, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /--host HOST/);
  assert.match(result.stdout, /--port PORT/);
  assert.match(result.stdout, /--no-open/);
  assert.match(result.stdout, /Локальный сервер Sing-box Config Builder/);
});


test("Docker image runs the backend unprivileged with a health check", () => {
  const dockerfile = read("sing-box-config-builder-local/Dockerfile");
  assert.match(dockerfile, /^FROM python:3\.13-alpine$/m);
  assert.match(dockerfile, /^USER builder$/m);
  assert.match(dockerfile, /^EXPOSE 8765$/m);
  assert.match(dockerfile, /^HEALTHCHECK /m);
  assert.match(dockerfile, /http:\/\/127\.0\.0\.1:8765\/api\/health/);
  assert.match(
    dockerfile,
    /CMD \["python", "sing-box-config-builder\.py", "--host", "0\.0\.0\.0", "--port", "8765", "--no-open"\]/,
  );
});


test("Compose keeps the builder local and applies hardening", () => {
  const compose = read("compose.yaml");
  assert.match(compose, /restart: unless-stopped/);
  assert.match(compose, /read_only: true/);
  assert.match(compose, /no-new-privileges:true/);
  assert.match(compose, /HAPP_HWID_FILE: \/run\/secrets\/happ_hwid/);
  assert.match(compose, /127\.0\.0\.1:\$\{BUILDER_PORT:-18765\}:8765/);
  assert.match(
    compose,
    /file: \.\/sing-box-config-builder-local\/\.happ-hwid/,
  );
});


test("Base config preserves the routing contract used by the generator", () => {
  const config = JSON.parse(
    read("sing-box-duckvpn-whitelist-direct-plus-vni-refreshed-2026-07-27.json"),
  );
  const tun = config.inbounds.find((inbound) => inbound.type === "tun");
  assert.ok(tun);
  assert.equal(tun.interface_name, "singtun0");
  assert.equal(tun.auto_route, true);
  assert.equal(tun.auto_redirect, true);
  assert.ok(tun.route_exclude_address.includes("192.168.0.0/16"));
  assert.equal(config.route.final, "SELECT");
  assert.equal(config.route.auto_detect_interface, true);
  assert.ok(config.route.rule_set[0].rules[0].domain_suffix.length > 0);
  assert.equal(
    config.experimental.clash_api.external_controller,
    "0.0.0.0:9090",
  );
  assert.equal(config.experimental.cache_file.enabled, true);
});


test("macOS launchers start the local Python server from their own directory", () => {
  for (const file of [
    "start-sing-box-builder.command",
    "sing-box-config-builder-local/start-sing-box-builder.command",
  ]) {
    const launcher = read(file);
    assert.match(launcher, /^#!\/bin\/zsh$/m);
    assert.match(launcher, /cd "\$SCRIPT_DIR" \|\| exit 1/);
    assert.match(
      launcher,
      /exec \/usr\/bin\/env python3 sing-box-config-builder\.py/,
    );
  }
});


test("README documents every supported launch and recovery path", () => {
  const readme = read("README.md");
  for (const requiredText of [
    "docker compose up -d --build",
    "http://127.0.0.1:18765/",
    "python3 sing-box-config-builder.py",
    "http://127.0.0.1:8765/",
    "sing-box check -c /etc/sing-box/config.json",
    "/etc/init.d/sing-box stop",
    "/etc/init.d/sing-box disable",
  ]) {
    assert.ok(readme.includes(requiredText), `README не содержит: ${requiredText}`);
  }
});
