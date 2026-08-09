import { MeterKind } from "../meters";

/**
 * The complete set of runtime user-facing strings.
 *
 * `en.ts` is the only bundle that must implement all of this; every other
 * locale supplies a `LocaleBundle` (see below) and inherits the rest.
 */
export interface Strings {
  title: string;
  refresh: string;
  retry: string;
  openConsole: string;
  loading: string;
  fetchFailed: string;
  staleNotice: string;

  // In-panel settings section.
  settingsTitle: string;
  statusBarWindowLabel: string;
  languageLabel: string;
  meterAutoLabel: string;
  openSettingsLabel: string;
  reconnectLabel: string;

  meterLabel: Record<MeterKind, string>;
  meterShortLabel: Record<MeterKind, string>;

  // Failures
  errTimeout: string;
  errNetwork: (detail: string) => string;
  errHttp: (status: number) => string;

  // The workspace console — the only source of usage.
  wsNoCredentials: string;
  wsCookieExpired: string;
  wsNoPayload: string;

  // First-run setup, shown in the panel. Deliberately short: the step-by-step
  // detail belongs in the input prompts, where it is read at the moment it is
  // needed rather than skimmed past.
  setupHeading: string;
  setupHint: string;
  setupStep1: string;
  setupStep2: string;
  setupStep3: string;
  connectWorkspaceButton: string;

  // The connect flow's own prompts, where the detail lives.
  wsConfigureTitle: string;
  wsWorkspaceIdPrompt: string;
  wsWorkspaceIdPlaceholder: string;
  wsWorkspaceIdInvalid: string;
  wsCookiePrompt: string;
  wsCookiePlaceholder: string;
  wsCookieRequired: string;
  wsHowTo: string;
  wsConfigured: (workspaceId: string) => string;
  wsCleared: string;

  // Countdown / clock
  resetsNow: string;
  resetsIn: (days: number, hours: number, minutes: number) => string;
  updatedAt: (clock: string) => string;
}

/** The two keys whose values are per-meter maps rather than plain strings. */
export const NESTED_KEYS = ["meterLabel", "meterShortLabel"] as const;

/**
 * What a translation file provides: any subset of `Strings`. Anything left out
 * — including individual meter labels — falls back to English, so a partial
 * translation is a perfectly valid contribution.
 */
export type LocaleBundle = {
  [K in keyof Strings]?: Strings[K] extends Record<string, string>
    ? Partial<Strings[K]>
    : Strings[K];
};

export interface Locale {
  /** BCP 47-ish code, e.g. "ja", "pt-BR". Matched case-insensitively. */
  code: string;
  /** Shown in the settings dropdown, in the language itself. */
  label: string;
  bundle: LocaleBundle;
}
