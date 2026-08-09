const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

const read = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));

const manifest = read("package.json");
const en = read("package.nls.json");

/** Every translated manifest bundle: package.nls.<code>.json. */
const translations = fs
  .readdirSync(ROOT)
  .filter((f) => /^package\.nls\.[^.]+\.json$/.test(f))
  .map((file) => ({ file, code: /^package\.nls\.(.+)\.json$/.exec(file)[1], bundle: read(file) }));

/** Every "%key%" placeholder anywhere in the manifest. */
function placeholders() {
  const found = new Set();
  const walk = (node) => {
    if (typeof node === "string") {
      const match = /^%(.+)%$/.exec(node);
      if (match) {
        found.add(match[1]);
      }
      return;
    }
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (node && typeof node === "object") {
      Object.values(node).forEach(walk);
    }
  };
  walk(manifest);
  return found;
}

test("every manifest placeholder is defined in the default bundle", () => {
  const missing = [...placeholders()].filter((key) => !(key in en));
  assert.deepEqual(missing, [], "keys used in package.json but absent from package.nls.json");
});

test("every translated manifest bundle covers the same keys as the default one", () => {
  assert.ok(translations.length > 0, "expected at least one package.nls.<code>.json");
  const enKeys = Object.keys(en).sort();
  for (const { file, bundle } of translations) {
    assert.deepEqual(
      Object.keys(bundle).sort(),
      enKeys,
      `${file} must define the same keys as package.nls.json`,
    );
  }
});

test("no manifest bundle entry is empty", () => {
  for (const { file, bundle } of [{ file: "package.nls.json", bundle: en }, ...translations]) {
    for (const [key, value] of Object.entries(bundle)) {
      assert.equal(typeof value, "string", `${file}: ${key} must be a string`);
      assert.notEqual(value.trim(), "", `${file}: ${key} must not be empty`);
    }
  }
});

test("each manifest translation matches a registered runtime locale", () => {
  const i18n = require(path.join(ROOT, "out", "i18n", "index.js"));
  const codes = i18n.LOCALES.map((l) => l.code.toLowerCase());
  for (const { file, code } of translations) {
    assert.ok(
      codes.includes(code.toLowerCase()),
      `${file} has no matching locale in src/i18n/index.ts (add one, or drop the file)`,
    );
  }
});

test("no bundle key is unused", () => {
  const used = placeholders();
  const unused = Object.keys(en).filter((key) => !used.has(key));
  assert.deepEqual(unused, [], "keys defined in package.nls.json but never referenced");
});

test("every registered locale resolves to a complete, well-typed bundle", () => {
  const i18n = require(path.join(ROOT, "out", "i18n", "index.js"));
  const { EN } = require(path.join(ROOT, "out", "i18n", "en.js"));

  for (const locale of i18n.LOCALES) {
    const resolved = i18n.strings(locale.code);

    // Fallback guarantees every key exists, whatever the bundle translated.
    assert.deepEqual(
      Object.keys(resolved).sort(),
      Object.keys(EN).sort(),
      `${locale.code} must expose the full string set`,
    );

    for (const key of Object.keys(EN)) {
      assert.equal(
        typeof resolved[key],
        typeof EN[key],
        `strings("${locale.code}").${key} must have the same type as English`,
      );
    }

    for (const kind of ["five_hour", "calendar_week", "product_period"]) {
      assert.ok(resolved.meterLabel[kind], `${locale.code} is missing meterLabel.${kind}`);
      assert.ok(
        resolved.meterShortLabel[kind],
        `${locale.code} is missing meterShortLabel.${kind}`,
      );
    }
  }
});

test("locale codes and labels are unique and non-empty", () => {
  const i18n = require(path.join(ROOT, "out", "i18n", "index.js"));
  const codes = i18n.LOCALES.map((l) => l.code);
  const labels = i18n.LOCALES.map((l) => l.label);

  assert.deepEqual([...new Set(codes)], codes, "duplicate locale codes");
  assert.deepEqual([...new Set(labels)], labels, "duplicate locale labels");
  for (const locale of i18n.LOCALES) {
    assert.notEqual(locale.code.trim(), "", "a locale code must not be empty");
    assert.notEqual(locale.label.trim(), "", "a locale label must not be empty");
  }
  assert.equal(codes[0], "en", "English must stay first — it is the fallback bundle");
});

test("the language setting's enum stays in sync with the locale registry", () => {
  const i18n = require(path.join(ROOT, "out", "i18n", "index.js"));
  const setting = manifest.contributes.configuration.properties["opencodeGo.language"];

  // Adding a locale to src/i18n/index.ts without updating package.json fails here,
  // and the diff tells you exactly what to paste in.
  assert.deepEqual(
    setting.enum,
    i18n.languageSettingValues(),
    "package.json opencodeGo.language.enum must match languageSettingValues()",
  );
  assert.deepEqual(
    setting.enumItemLabels,
    i18n.languageSettingLabels(),
    "package.json opencodeGo.language.enumItemLabels must match languageSettingLabels()",
  );
  assert.equal(setting.default, "en", "English is the default language");
});
