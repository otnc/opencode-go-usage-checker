#!/usr/bin/env node
// Reads VSCE_PAT from .env (gitignored) and runs `vsce publish` with it, so the token never
// needs to be typed into a shell or exported by hand. No dependency on dotenv.
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const envPath = path.join(root, ".env");

if (!existsSync(envPath)) {
  console.error(`Missing ${envPath}. Copy .env.example to .env and fill in VSCE_PAT.`);
  process.exit(1);
}

const env = { ...process.env };
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const match = /^\s*([\w.-]+)\s*=\s*(.*)\s*$/.exec(line);
  if (!match) {
    continue;
  }
  const [, key, rawValue] = match;
  const value = rawValue.replace(/^(['"])(.*)\1$/, "$2");
  env[key] = value;
}

if (!env.VSCE_PAT) {
  console.error("VSCE_PAT is not set in .env");
  process.exit(1);
}

const args = process.argv.slice(2);
const result = spawnSync("npx", ["vsce", "publish", ...args], {
  cwd: root,
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});
process.exit(result.status ?? 1);
