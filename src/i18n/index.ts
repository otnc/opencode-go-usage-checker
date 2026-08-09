import { EN } from "./en";
import { JA } from "./ja";
import { Locale, LocaleBundle, NESTED_KEYS, Strings } from "./types";

export type { Locale, LocaleBundle, Strings } from "./types";

/**
 * Adding a language
 * -----------------
 * 1. Create `src/i18n/<code>.ts` exporting a `LocaleBundle` (see `ja.ts`).
 *    Translate as much or as little as you like — the rest falls back to
 *    English.
 * 2. Add one entry to LOCALES below.
 * 3. Run `npm test`. The suite regenerates nothing, but it does assert that
 *    the `opencodeGo.language` enum in package.json matches this list, and it
 *    will tell you exactly what to paste in.
 *
 * No other file needs to change.
 */
export const LOCALES: Locale[] = [
  { code: "en", label: "English", bundle: {} },
  { code: "ja", label: "日本語", bundle: JA },
];

/** `auto` follows VS Code's display language. */
export const AUTO = "auto";

/** A language code, or `auto`. Deliberately a plain string: locales are data. */
export type Lang = string;

export const DEFAULT_LANG: Lang = "en";

/** Values accepted by the `opencodeGo.language` setting, in dropdown order. */
export function languageSettingValues(): string[] {
  return [AUTO, ...LOCALES.map((l) => l.code)];
}

export function languageSettingLabels(): string[] {
  return ["Auto", ...LOCALES.map((l) => l.label)];
}

function findLocale(code: string): Locale | undefined {
  const wanted = code.toLowerCase();
  const exact = LOCALES.find((l) => l.code.toLowerCase() === wanted);
  if (exact) {
    return exact;
  }
  // "pt-BR" should find a "pt" bundle, and "ja" should find a "ja-JP" one.
  const primary = wanted.split(/[-_]/)[0];
  return LOCALES.find((l) => l.code.toLowerCase().split(/[-_]/)[0] === primary);
}

/**
 * Resolves the `opencodeGo.language` setting to a concrete locale code.
 *
 * `displayLanguage` is VS Code's `env.language`; it is passed in rather than
 * imported so this module stays free of `vscode` and remains unit-testable.
 */
export function toLang(value: unknown, displayLanguage?: string): Lang {
  if (typeof value === "string" && value !== "" && value !== AUTO) {
    return findLocale(value)?.code ?? DEFAULT_LANG;
  }
  if (value === AUTO && typeof displayLanguage === "string") {
    return findLocale(displayLanguage)?.code ?? DEFAULT_LANG;
  }
  return DEFAULT_LANG;
}

/** Overlays a partial bundle onto English, one level deep for the meter maps. */
function resolveBundle(bundle: LocaleBundle): Strings {
  const merged = { ...EN, ...bundle } as Strings;
  for (const key of NESTED_KEYS) {
    merged[key] = { ...EN[key], ...bundle[key] };
  }
  return merged;
}

const cache = new Map<string, Strings>();

/** The resolved strings for `lang`, falling back to English key by key. */
export function strings(lang: Lang): Strings {
  const locale = findLocale(lang);
  if (!locale) {
    return EN;
  }
  let resolved = cache.get(locale.code);
  if (!resolved) {
    resolved = resolveBundle(locale.bundle);
    cache.set(locale.code, resolved);
  }
  return resolved;
}
