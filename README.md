# OpenCode Go Usage

See your OpenCode Go usage limits — **rolling 5 hours, weekly, and monthly** — in the VS Code
status bar, without opening the console in a browser. Know how much of each window you have used,
and how long until it resets.

日本語版は [README.ja.md](README.ja.md) にあります。

```
Status bar:  $(pulse) Go Usage 5h 62%

Panel:
  Rolling 5 hours
  ████████░░░░  62%
  resets in 1h 12m

  Weekly
  ███░░░░░░░░░  31%
  resets in 3d 4h

  Monthly
  █████░░░░░░░  44%
  resets in 12d
```

## Features

- **Always visible.** The status bar shows the rolling 5-hour window by default, or whichever
  window you pick — `auto` follows the most constrained one. It turns amber at 70% and red at
  90%.
- **All three at a glance.** Click the status bar to open the panel, or hover for a tooltip
  breakdown — each window with a progress bar and a countdown to when it resets.
- **Stays current on its own.** Refreshes every 5 minutes and whenever you come back to the
  window, and pauses while VS Code is in the background so it is not polling behind your back.
- **English and Japanese**, or `auto` to follow VS Code's display language.

## Installation

Install **OpenCode Go Usage Checker** from the VS Code Marketplace, or:

```
code --install-extension otoneko1102.opencode-go-usage-checker
```

## Setup

Run **OpenCode Go: Connect workspace** (or press the button in the panel) and give it two things:

1. **Your workspace ID.** Open your workspace at opencode.ai while signed in and copy the `wrk_…`
   segment out of the address bar: `opencode.ai/console/`**`wrk_…`**`/go`
2. **Your session cookie.** With that page open, press <kbd>F12</kbd> → Application → Storage → Cookies → `https://opencode.ai`, select the row named `__Host-console_session`, and copy its **Value**.

The cookie is stored in VS Code's SecretStorage — never in a settings file. The workspace ID is an
ordinary setting. **OpenCode Go: Disconnect workspace** removes both.

The cookie is a browser session, so it expires. When it does, the panel says so explicitly and you
reconnect with a fresh one.

## Commands

| Command | Description |
| --- | --- |
| `OpenCode Go: Show usage` | Open the panel (where the status bar click goes) |
| `OpenCode Go: Refresh usage` | Fetch again now |
| `OpenCode Go: Connect workspace…` | Set the workspace ID and the session cookie |
| `OpenCode Go: Disconnect workspace` | Forget both |
| `OpenCode Go: Open console in browser` | Open your workspace page |
| `OpenCode Go: Show diagnostics` | Print what the console returned next to the parsed numbers |

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `opencodeGo.language` | `auto` | Panel and tooltip language. `auto` follows VS Code's display language |
| `opencodeGo.statusBar.enabled` | `true` | Show usage in the status bar |
| `opencodeGo.statusBar.meter` | `five_hour` | Which window to show: `five_hour`, `calendar_week`, `product_period`, or `auto` (most constrained) |
| `opencodeGo.refreshInterval` | `300` | Refresh interval in seconds. `0` disables it; values under 60 are rounded up |
| `opencodeGo.workspaceId` | *(empty)* | The `wrk_…` to read. Set via **Connect workspace** |
| `opencodeGo.baseUrl` | `https://opencode.ai` | Console origin. Only change this for a different deployment |

## How it works, and what that costs

OpenCode publishes no documented usage API. The workspace console is a client-rendered app whose page loads its numbers from an internal JSON endpoint, and this extension calls that same endpoint with your session cookie:

```
GET /console/api/go/status   (x-org-id: wrk_…)
{ "access": { "meters": { "fiveHour": {…}, "week": {…}, "month": {…} } } }
```

Each meter reports used and limit amounts, and the extension turns them into a percentage. That is an **undocumented endpoint**, with the consequences you would expect:

- It shows **percentages and reset times only**. Dollar figures are not shown, because the extension has no reason to invent them.
- **A change to the endpoint will break it.** When that happens the panel says the console returned no usage figures, rather than showing a confident zero.
- It depends on a **browser session cookie**, which expires on its own schedule.

An expired session and a changed endpoint are reported as two different things, because the fix differs: one needs a fresh cookie, the other needs a code change.

## License

MIT — see [LICENSE](LICENSE).
