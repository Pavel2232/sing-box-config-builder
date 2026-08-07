import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";


const projectRoot = path.resolve(import.meta.dirname, "../..");
const buildScript = fs.readFileSync(
  path.join(projectRoot, "build-sing-box-config-builder.mjs"),
  "utf8",
);


function runFixture({ template, baseConfig }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sing-box-builder-test-"));
  fs.mkdirSync(path.join(root, "sing-box-config-builder-local"));
  fs.writeFileSync(
    path.join(root, "build-sing-box-config-builder.mjs"),
    buildScript,
  );
  fs.writeFileSync(
    path.join(root, "sing-box-config-builder.template.html"),
    template,
  );
  fs.writeFileSync(
    path.join(
      root,
      "sing-box-duckvpn-whitelist-direct-plus-vni-refreshed-2026-07-27.json",
    ),
    JSON.stringify(baseConfig),
  );
  const result = spawnSync(
    process.execPath,
    ["build-sing-box-config-builder.mjs"],
    { cwd: root, encoding: "utf8" },
  );
  return { root, result };
}


function embeddedConfig(html) {
  const match = html.match(
    /<script type="application\/json" id="baseConfig">([\s\S]*?)<\/script>/,
  );
  assert.ok(match, "в HTML должен присутствовать встроенный baseConfig");
  return JSON.parse(match[1]);
}


test("build embeds a safe base config and clears old VPN outbounds", () => {
  const fixture = runFixture({
    template:
      '<main>before</main><script type="application/json" id="baseConfig">__BASE_CONFIG_JSON__</script>',
    baseConfig: {
      outbounds: [{ type: "vless", tag: "old-secret-node" }],
      experimental: { clash_api: { secret: "keep-this-secret" } },
      marker: "</script>&",
    },
  });
  try {
    assert.equal(fixture.result.status, 0, fixture.result.stderr);
    const rootHtml = fs.readFileSync(
      path.join(fixture.root, "sing-box-config-builder.html"),
      "utf8",
    );
    const dockerHtml = fs.readFileSync(
      path.join(
        fixture.root,
        "sing-box-config-builder-local/sing-box-config-builder.html",
      ),
      "utf8",
    );
    assert.equal(rootHtml, dockerHtml);
    assert.ok(!rootHtml.includes("old-secret-node"));
    assert.ok(rootHtml.includes("\\u003c/script\\u003e\\u0026"));
    assert.deepEqual(embeddedConfig(rootHtml), {
      outbounds: [],
      experimental: { clash_api: { secret: "keep-this-secret" } },
      marker: "</script>&",
    });
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});


test("build fails loudly when the template placeholder is absent", () => {
  const fixture = runFixture({
    template: "<main>placeholder missing</main>",
    baseConfig: { outbounds: [] },
  });
  try {
    assert.notEqual(fixture.result.status, 0);
    assert.match(fixture.result.stderr, /Template placeholder is missing/);
  } finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});


test("checked-in generated HTML files are synchronized and executable", () => {
  const rootHtml = fs.readFileSync(
    path.join(projectRoot, "sing-box-config-builder.html"),
    "utf8",
  );
  const dockerHtml = fs.readFileSync(
    path.join(
      projectRoot,
      "sing-box-config-builder-local/sing-box-config-builder.html",
    ),
    "utf8",
  );
  assert.equal(rootHtml, dockerHtml);
  assert.ok(!rootHtml.includes("__BASE_CONFIG_JSON__"));

  const config = embeddedConfig(rootHtml);
  assert.deepEqual(config.outbounds, []);
  assert.ok(config.inbounds.some((inbound) => inbound.type === "tun"));
  assert.ok(config.route.rule_set[0].rules[0].domain_suffix.length > 0);
  assert.ok(config.experimental.clash_api.secret.length >= 8);

  const scripts = [...rootHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.equal(scripts.length, 1);
  assert.doesNotThrow(() => new Function(scripts[0][1]));
});
