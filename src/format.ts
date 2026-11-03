import { Lang, strings } from "./i18n";
import { MeterKind, orderedMeters, UsageMeter, usedPercent } from "./meters";
import { WorkspaceError } from "./workspace";

export type { Lang } from "./i18n";

export function meterLabel(kind: MeterKind, lang: Lang): string {
  return strings(lang).meterLabel[kind] ?? kind;
}

export function meterShortLabel(kind: MeterKind, lang: Lang): string {
  return strings(lang).meterShortLabel[kind] ?? kind;
}

/**
 * "Go 5h 62% · Week 31% · Month 44%" — every window on one line, for the
 * status bar. Empty when there is no window to show.
 */
export function statusBarMetersText(meters: UsageMeter[], lang: Lang): string {
  const parts = orderedMeters(meters).map(
    (meter) => `${meterShortLabel(meter.kind, lang)} ${usedPercent(meter)}%`,
  );
  return parts.length > 0 ? `Go ${parts.join(" · ")}` : "";
}

/**
 * "resets in 1h 12m" / "あと 1時間12分で回復". Returns null when there is no
 * reset time. Drops to the coarser unit past a day, which matches how the
 * console talks about weekly and monthly windows.
 */
export function formatCountdown(
  resetsAt: string | null,
  lang: Lang,
  now = Date.now(),
): string | null {
  if (!resetsAt) {
    return null;
  }
  const target = Date.parse(resetsAt);
  if (!Number.isFinite(target)) {
    return null;
  }
  const remainingMs = target - now;
  if (remainingMs <= 0) {
    return strings(lang).resetsNow;
  }

  const totalMinutes = Math.floor(remainingMs / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  return strings(lang).resetsIn(days, hours, minutes);
}

export function formatClock(ms: number, lang: Lang): string {
  const date = new Date(ms);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return strings(lang).updatedAt(`${hh}:${mm}`);
}

/** Renders a WorkspaceError (or any other throwable) as a message in `lang`. */
export function describeError(err: unknown, lang: Lang): string {
  const s = strings(lang);
  if (err instanceof WorkspaceError) {
    switch (err.failure.kind) {
      case "noCredentials":
        return s.wsNoCredentials;
      case "timeout":
        return s.errNetwork(s.errTimeout);
      case "network":
        return s.errNetwork(err.failure.detail);
      case "unauthorized":
        return s.wsCookieExpired;
      case "http":
        return s.errHttp(err.failure.status);
      case "noPayload":
        return err.failure.sawLogin ? s.wsCookieExpired : s.wsNoPayload;
    }
  }
  return err instanceof Error ? err.message : String(err);
}
