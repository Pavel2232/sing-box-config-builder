import fs from "node:fs";

const templatePath = "sing-box-config-builder.template.html";
const baseConfigPath =
  "sing-box-duckvpn-whitelist-direct-plus-vni-refreshed-2026-07-27.json";
const directDomainsPath = "data/direct-domains.txt";
const sourceParts = [
  ["__APP_CSS__", "src/styles.css"],
  ["__PARSER_NORMALIZATION_JS__", "src/parser-normalization.js"],
  ["__PARSER_TRANSPORTS_JS__", "src/parser-transports.js"],
  ["__SUBSCRIPTION_PARSER_JS__", "src/subscription-parser.js"],
  ["__SOURCE_UI_JS__", "src/source-ui.js"],
  ["__APP_JS__", "src/app.js"],
];
const outputPaths = [
  "sing-box-config-builder.html",
  "sing-box-config-builder-local/sing-box-config-builder.html",
];

const template = fs.readFileSync(templatePath, "utf8");
const baseConfig = JSON.parse(fs.readFileSync(baseConfigPath, "utf8"));

// Old VPN nodes are recreated from subscriptions. Keep the Clash API secret:
// this is a personal local builder and changing that value makes existing
// Yacd connections fail with HTTP 401 after every generated config update.
baseConfig.outbounds = [];

if (fs.existsSync(directDomainsPath)) {
  const domains = [
    ...new Set(
      fs
        .readFileSync(directDomainsPath, "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim().toLowerCase())
        .filter((line) => line && !line.startsWith("#")),
    ),
  ].sort();
  const invalidDomains = domains.filter(
    (domain) =>
      domain.length > 253 ||
      !domain.includes(".") ||
      !/^[a-z0-9._-]+$/.test(domain),
  );
  if (domains.length === 0 || invalidDomains.length > 0) {
    throw new Error(
      invalidDomains.length > 0
        ? `Invalid DIRECT domains: ${invalidDomains.join(", ")}`
        : "DIRECT domain list is empty",
    );
  }
  baseConfig.route.rule_set[0].rules[0].domain_suffix = domains;
}

const embeddedConfig = JSON.stringify(baseConfig)
  .replaceAll("<", "\\u003c")
  .replaceAll(">", "\\u003e")
  .replaceAll("&", "\\u0026");

if (!template.includes("__BASE_CONFIG_JSON__")) {
  throw new Error("Template placeholder is missing");
}

let output = template;
for (const [placeholder, sourcePath] of sourceParts) {
  if (!output.includes(placeholder)) continue;
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Source part is missing: ${sourcePath}`);
  }
  output = output.replace(placeholder, fs.readFileSync(sourcePath, "utf8").trim());
}
output = output.replace("__BASE_CONFIG_JSON__", embeddedConfig);

for (const outputPath of outputPaths) {
  fs.writeFileSync(outputPath, output);
}

// Docker keeps a self-contained context for compatibility. These copies are
// generated from the root runtime sources, so they are never edited manually.
for (const [sourcePath, outputPath] of [
  ["sing-box-config-builder.py", "sing-box-config-builder-local/sing-box-config-builder.py"],
  ["start-sing-box-builder.command", "sing-box-config-builder-local/start-sing-box-builder.command"],
]) {
  if (fs.existsSync(sourcePath) && fs.existsSync("sing-box-config-builder-local")) {
    fs.copyFileSync(sourcePath, outputPath);
  }
}

process.stdout.write(`${outputPaths.join("\n")}\n`);
