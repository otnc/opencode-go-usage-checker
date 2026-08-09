import { Strings } from "./types";

/**
 * The base bundle. This is the only locale that must be complete — every other
 * locale falls back to these values for anything it does not translate.
 */
export const EN: Strings = {
  title: "OpenCode Go Usage",
  refresh: "Refresh",
  retry: "Retry",
  openConsole: "Open console",
  loading: "Loading…",
  fetchFailed: "Could not fetch usage",
  staleNotice: "Showing the last values that were fetched.",

  settingsTitle: "Settings",
  statusBarWindowLabel: "Status bar window",
  languageLabel: "Language",
  meterAutoLabel: "Auto (most constrained)",
  openSettingsLabel: "Open settings",

  meterLabel: {
    five_hour: "Rolling 5 hours",
    calendar_week: "Weekly",
    product_period: "Monthly",
  },
  meterShortLabel: {
    five_hour: "5h",
    calendar_week: "Week",
    product_period: "Month",
  },

  errTimeout: "the request timed out",
  errNetwork: (detail) => `Could not connect: ${detail}`,
  errHttp: (status) => `The console answered HTTP ${status}.`,

  wsNoCredentials: "Connect a workspace to see your usage.",
  wsCookieExpired:
    "The workspace session has expired. Sign in to opencode.ai in your browser again, " +
    "then reconnect with the new auth cookie.",
  wsNoPayload:
    "The workspace page loaded but contained no usage figures. The page layout may have changed.",

  setupHeading: "Not connected yet",
  setupHint:
    "Usage is read from your workspace console page, so this needs your workspace ID and " +
    "the browser session cookie that goes with it. You will be asked for both in turn.",
  setupStep1: "1. Open your workspace in a browser, signed in.",
  setupStep2: "2. Copy the wrk_… ID out of the address bar.",
  setupStep3: "3. Copy the `auth` cookie from DevTools.",
  connectWorkspaceButton: "Connect workspace",

  wsConfigureTitle: "OpenCode Go: connect workspace",
  wsWorkspaceIdPrompt:
    "Workspace ID — open opencode.ai in your browser, go to your workspace, and copy the " +
    "wrk_… segment from the address bar: opencode.ai/workspace/WRK_ID/go",
  wsWorkspaceIdPlaceholder: "wrk_01ABCDEFGHIJKLMNOPQRSTUVWX",
  wsWorkspaceIdInvalid: "That does not look like a workspace ID (expected wrk_…).",
  wsCookiePrompt: "The value of the `auth` cookie for opencode.ai",
  wsCookiePlaceholder: "paste the cookie value",
  wsCookieRequired: "Paste the auth cookie value.",
  wsHowTo:
    "With opencode.ai open and signed in, press F12 → Application → Storage → Cookies → " +
    "https://opencode.ai, select the row named `auth`, and copy its Value. " +
    "It is stored in VS Code's SecretStorage, never in a settings file.",
  wsConfigured: (workspaceId) => `OpenCode Go: reading usage from ${workspaceId}.`,
  wsCleared: "OpenCode Go: workspace disconnected.",

  resetsNow: "resetting now",
  resetsIn: (days, hours, minutes) => {
    if (days > 0) {
      return hours > 0 ? `resets in ${days}d ${hours}h` : `resets in ${days}d`;
    }
    if (hours > 0) {
      return minutes > 0 ? `resets in ${hours}h ${minutes}m` : `resets in ${hours}h`;
    }
    return `resets in ${Math.max(1, minutes)}m`;
  },
  updatedAt: (clock) => `updated ${clock}`,
};
