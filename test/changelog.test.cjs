const assert = require("node:assert/strict");
const { test } = require("node:test");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");

/** The extractor is ESM; load it once for the whole file. */
const loadExtractor = (() => {
  let promise;
  return () => {
    if (!promise) {
      const url = new URL(
        `file://${path.join(ROOT, "scripts", "changelog-section.mjs").replace(/\\/g, "/")}`,
      );
      promise = import(url.href);
    }
    return promise;
  };
})();

const SAMPLE = `# Changelog

## [Unreleased]

## [1.2.0] - 2026-09-01

### Added

- A thing.

### Fixed

- Another thing.

## [1.1.0] - 2026-08-01

Older release.

[Unreleased]: https://example.com/compare/v1.2.0...HEAD
[1.2.0]: https://example.com/releases/tag/v1.2.0
`;

test("extracts just the requested version's body", async () => {
  const { extractSection } = await loadExtractor();
  const section = extractSection(SAMPLE, "1.2.0");

  assert.match(section, /### Added/);
  assert.match(section, /- A thing\./);
  assert.match(section, /### Fixed/);
  // It must stop at the next version heading.
  assert.doesNotMatch(section, /Older release/);
  assert.doesNotMatch(section, /1\.1\.0/);
  // Link-reference definitions are plumbing, not release notes.
  assert.doesNotMatch(section, /example\.com/);
  assert.equal(section, section.trim(), "no leading or trailing blank lines");
});

test("accepts a v-prefixed tag name", async () => {
  const { extractSection } = await loadExtractor();
  assert.equal(extractSection(SAMPLE, "v1.2.0"), extractSection(SAMPLE, "1.2.0"));
});

test("reads the last section in the file", async () => {
  const { extractSection } = await loadExtractor();
  const section = extractSection(SAMPLE, "1.1.0");
  assert.match(section, /Older release\./);
  assert.doesNotMatch(section, /example\.com/);
});

test("returns null for a version that has no section", async () => {
  const { extractSection } = await loadExtractor();
  assert.equal(extractSection(SAMPLE, "9.9.9"), null);
  // A prefix of a real version must not match it.
  assert.equal(extractSection(SAMPLE, "1.2"), null);
});

test("distinguishes an empty section from a missing one", async () => {
  const { extractSection } = await loadExtractor();
  assert.equal(extractSection(SAMPLE, "Unreleased"), "", "present but empty");
});

test("the current package version has usable release notes", async () => {
  const { extractSection } = await loadExtractor();
  const version = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;
  const markdown = fs.readFileSync(path.join(ROOT, "CHANGELOG.md"), "utf8");

  const section = extractSection(markdown, version);
  assert.notEqual(section, null, `CHANGELOG.md has no "## [${version}]" section`);
  assert.notEqual(section, "", `the CHANGELOG.md section for ${version} is empty`);
});
