#!/usr/bin/env node
/**
 * Prints the CHANGELOG.md body for one version, for use as GitHub Release notes.
 *
 *   node scripts/changelog-section.mjs 0.1.0
 *   node scripts/changelog-section.mjs v0.1.0 > notes.md
 *
 * Takes everything between the `## [<version>]` heading and the next `##`
 * heading, drops the trailing link-reference definitions, and trims. Exits
 * non-zero if the version has no section, so a release cannot ship with empty
 * notes.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

export function extractSection(markdown, version) {
  const wanted = version.replace(/^v/, "");
  const lines = markdown.split(/\r?\n/);

  // Matches "## [0.1.0] - 2026-08-09", "## 0.1.0", "## [0.1.0]".
  const isHeadingFor = (line) => {
    const match = /^##\s+\[?([^\]\s]+)\]?/.exec(line);
    return match ? match[1] === wanted : false;
  };

  const start = lines.findIndex(isHeadingFor);
  if (start === -1) {
    return null;
  }

  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^##\s/.test(line));
  const body = end === -1 ? rest : rest.slice(0, end);

  return (
    body
      // Link-reference definitions at the bottom are Markdown plumbing, not notes.
      .filter((line) => !/^\[[^\]]+\]:\s+\S+/.test(line))
      .join("\n")
      .trim()
  );
}

// Only run when invoked directly, so the function stays importable by tests.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const version = process.argv[2];
  if (!version) {
    console.error("usage: node scripts/changelog-section.mjs <version>");
    process.exit(2);
  }

  const markdown = readFileSync(join(root, "CHANGELOG.md"), "utf8");
  const section = extractSection(markdown, version);

  if (section === null) {
    console.error(`No CHANGELOG.md section found for version ${version}.`);
    console.error(`Add a "## [${version.replace(/^v/, "")}] - <date>" heading before releasing.`);
    process.exit(1);
  }
  if (section === "") {
    console.error(`The CHANGELOG.md section for ${version} is empty.`);
    process.exit(1);
  }

  process.stdout.write(`${section}\n`);
}
