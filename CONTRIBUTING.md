# Contributing

## Development

```bash
npm install
npm run watch        # esbuild watch build
npm run check-types  # type check
npm test             # logic tests (39)
npm run format       # prettier --write .
npm run format:check # prettier --check . (CI-friendly)
```

Open the folder in VS Code and press `F5` (Run Extension) to launch an Extension Development Host.
`npm run package` produces a `.vsix` you can install into your normal VS Code with
`code --install-extension opencode-go-usage-checker-<version>.vsix`.

`test/` covers the scraper (both serialisation shapes, field order, clamping, and the difference
between a dead session and a changed page), the display logic (countdowns, thresholds), the locale
registry and its fallback behaviour, the manifest localisation bundles, and the changelog extractor
used for release notes. Nothing in the suite touches the network or your real credentials.

## How it works

| File | Role |
| --- | --- |
| `src/workspace.ts` | Fetching and parsing `opencode.ai/workspace/<wrk_…>/go` — the only source |
| `src/workspaceCredentials.ts` | Workspace id (settings) and `auth` cookie (SecretStorage) |
| `src/meters.ts` | The usage model: three windows, percentages, thresholds, ordering |
| `src/usageStore.ts` | Single source of state, polling, focus handling |
| `src/ui/statusBar.ts` | Status bar item and tooltip |
| `src/ui/usageView.ts` | The panel (webview); display strings are built on the extension host |
| `src/ui/workspaceCommands.ts` | The connect/disconnect prompts |
| `src/ui/diagnostics.ts` | "Show diagnostics" output — what the page gave vs. what we parsed |
| `src/format.ts` | Countdowns, clocks, and rendering errors as localised messages |
| `src/i18n/` | Locale registry; `en.ts` is the base every other bundle falls back to |
| `scripts/changelog-section.mjs` | Extracts one version's CHANGELOG section for release notes |

Formatting is Prettier with the repo config (`printWidth: 100`). `*.md` is deliberately excluded —
the prose in this repo is hand-wrapped, and reflowing it would churn every diff. Run `npm run
format` before committing.

## The source

OpenCode publishes no usage API. `opencode.ai` serves no `/api/*` at all — every path returns the
SolidStart 404 page — and `/workspace/<wrk_…>/go` is an app whose data arrives through server
functions. It does serialise the resolved values into the delivered HTML, and that is what
`src/workspace.ts` reads:

    rollingUsage:$R[12]={status:"ok",resetInSec:17400,usagePercent:42}

Two shapes are in circulation (a `$R[n]` reference and a plain assignment) and the key order inside
the braces is not guaranteed, so each field is matched independently. The search is confined to
`<script>` bodies — a DOM library would buy nothing, since the numbers are in serialised JavaScript
rather than in markup.

Consequences worth keeping in mind when changing this code:

- The page reports **no amounts**, so `UsageMeter` has no money in it. Adding a zeroed amount field
  would put "$0.00" on screen and assert something never measured.
- Failures are typed (`WorkspaceFailure`) because "your session died" and "the page changed" need
  different fixes. Never collapse them into one message, and never let either become a silent 0%.
- Authentication is a **browser session cookie**, not a token. It cannot be refreshed
  programmatically; it can only be re-pasted.

## Adding a language

Translations are data, not code — nothing outside `src/i18n/` needs to change, and a **partial
translation is fine**: any key you leave out falls back to English, including individual meter
labels.

1. Create `src/i18n/<code>.ts` exporting a `LocaleBundle`. Copy `ja.ts` and translate what you
   want; delete the lines you don't. `resetsIn` is a function rather than a template so a locale
   can put the units wherever its grammar needs them.

   ```ts
   import { LocaleBundle } from "./types";

   export const DE: LocaleBundle = {
     refresh: "Aktualisieren",
     meterLabel: { five_hour: "Rollierende 5 Stunden" },
   };
   ```

2. Register it in `src/i18n/index.ts`:

   ```ts
   export const LOCALES: Locale[] = [
     { code: "en", label: "English", bundle: {} },
     { code: "ja", label: "日本語", bundle: JA },
     { code: "de", label: "Deutsch", bundle: DE },
   ];
   ```

3. Run `npm test`. The suite checks that `opencodeGo.language`'s `enum` and `enumItemLabels` in
   `package.json` match the registry, and tells you exactly what they should be — paste that in.

Region codes work in both directions: `pt-BR` finds a `pt` bundle, and `ja` finds a `ja-JP` one.

Command titles and setting descriptions are localised separately, by VS Code itself. To translate
those, add `package.nls.<code>.json` alongside `package.nls.json` with the same keys; the test
suite verifies the key sets match and that the code corresponds to a registered locale.

## Releasing

Published to the VS Code Marketplace as `otoneko1102.opencode-go-usage-checker` by
[.github/workflows/release.yml](.github/workflows/release.yml), triggered manually — there is no
tag-push trigger. The repository needs one secret: `VSCE_PAT`, an Azure DevOps personal access
token with the **Marketplace → Manage** scope. Without it, the workflow still runs and still
tags and releases on GitHub — publishing to the Marketplace is simply skipped.

1. Add a `## [x.y.z]` section to [CHANGELOG.md](CHANGELOG.md) describing the change. **This
   becomes the GitHub Release body** when present — the notes are curated, not generated from
   commits. If you skip this, the release still happens; GitHub's auto-generated notes are used
   instead.
2. Run **Actions → release → Run workflow**, with `version` set to either a semver bump keyword
   (`patch` / `minor` / `major` / `prerelease`) or an explicit version like `0.2.0`. Leave
   `dry_run` off.

The workflow bumps `package.json` itself (`npm version <input>`), runs format/type/test checks,
packages the `.vsix`, publishes to the Marketplace (if `VSCE_PAT` is set), then commits the bump,
tags it `vx.y.z`, pushes both, and creates the GitHub Release with the `.vsix` attached. A run with
the same version as the last release skips the commit but still tags and releases — useful for
retrying a run that failed after the bump landed.

Check **dry run** to rehearse it — it runs every check, builds, and packages, but commits, tags,
publishes, and releases nothing.

### Publishing by hand

The tag is the normal path; this is the fallback for when CI is unavailable.

```bash
cp .env.example .env   # then paste the PAT into it
npm run publish        # scripts/publish.mjs reads .env and runs `vsce publish`
```

`.env` is gitignored and excluded from the `.vsix`, so the token stays local — it never has to be
typed into a shell or exported by hand, which is what keeps it out of your shell history. The
workflow does not read `.env`; it uses the `VSCE_PAT` repository secret.

Note that `.env.*` in [.gitignore](.gitignore) would swallow `.env.example` as well, so the
template is re-included with an explicit `!.env.example`. If you add another committed template,
it needs the same treatment.
