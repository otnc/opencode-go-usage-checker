# Changelog

All notable changes to this extension are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-08-09

Initial release.

### Usage at a glance

- A status bar item shows whichever OpenCode Go window is closest to its limit — rolling 5 hours,
  weekly, or monthly — turning amber at 70% and red at 90%. Hovering breaks down all three
  windows; clicking opens the panel.
- The activity bar panel renders each window as a progress bar with a "resets in …" countdown, so
  the answer to "can I keep going?" does not require a trip to the browser.
- Refreshes every 5 minutes by default and whenever the window regains focus, throttled to at most
  one fetch every 30 seconds. Polling stops entirely while VS Code is in the background. Intervals
  below 60 seconds are rounded up; `0` disables automatic refresh.

### Where the numbers come from

- OpenCode publishes no usage API. `opencode.ai` serves no `/api/*` at all — every path returns
  the SolidStart 404 page — and `/workspace/<wrk_…>/go` is an app whose data arrives through
  server functions. It does serialise the resolved values into the HTML it delivers, so this
  extension fetches that page and reads them out of it:

  ```
  rollingUsage:$R[12]={status:"ok",resetInSec:17400,usagePercent:42}
  ```

- Two serialisation shapes are handled (a `$R[n]` reference and a plain assignment), key order
  inside the object is not assumed, and the search is confined to `<script>` bodies so that prose
  containing a window's name cannot be mistaken for the payload.
- **The page reports percentages and reset times, and no amounts** — so neither does this
  extension. The usage model carries no money at all, because a zeroed amount field would render
  as "$0.00" and assert something that was never measured.

### Setup

- **OpenCode Go: Connect workspace** asks for the two things the page needs: the `wrk_…` from the
  console URL, and the browser's `auth` cookie. The cookie is a live credential and is kept in VS
  Code's SecretStorage, never in a settings file; the workspace ID is an ordinary setting.
  **Disconnect workspace** removes both.
- Until that is done the panel shows a short explanation of what the connection needs and the
  three places to get it, in the display language. The step-by-step detail lives in the two input
  prompts, where it is read at the moment it is needed rather than skimmed past.
- **OpenCode Go: Show diagnostics** prints the resolved URL, the cookie's length (never its
  value), and every parsed window next to what the page yielded.

### Infrastructure

- Failures are typed rather than collapsed into one message, because they need different fixes: an
  expired session wants a fresh cookie, a page that no longer carries usage figures wants a new
  parser. A redirect to `/auth/authorize` is followed manually so it reports as a dead session
  instead of an unhelpful 200, and being served the login page with a 200 is recognised too.
  Neither failure is ever allowed to surface as a confident 0%.
- A fetch error keeps the last good values on screen, dimmed, so stale numbers are
  distinguishable from current ones.
- Runtime strings live in a locale registry (`src/i18n/`) where a translation may be partial —
  anything a bundle omits falls back to English key by key, including individual meter labels.
  English and Japanese ship; `auto` follows VS Code's display language. Manifest strings are
  localised separately through `package.nls*.json`, and the test suite verifies the key sets match.
- Prettier owns formatting (`printWidth: 100`), enforced by its own CI job. `*.md` is excluded so
  hand-wrapped prose is not reflowed on every save.
- No runtime dependencies; the packaged `.vsix` is about 22 KB.
- `npm run publish` reads `VSCE_PAT` from a gitignored `.env` for publishing by hand. The release
  workflow ignores that file and uses the repository secret.

### Known limitations

- This is a **scrape**, so a redesign of the workspace page will break it. When that happens the
  panel says the page carried no usage figures rather than showing a zero.
- Authentication is a browser session cookie, which expires on its own schedule and **cannot be
  refreshed programmatically** — it can only be re-pasted. The panel says so explicitly when it
  happens.
- Amounts and renewal dates are not available from this source, only percentages and reset times.

[Unreleased]: https://github.com/otnc/opencode-go-usage-checker/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/otnc/opencode-go-usage-checker/releases/tag/v0.1.0
