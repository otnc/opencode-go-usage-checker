/**
 * The usage model.
 *
 * There is exactly one source — the workspace console — and it reports
 * percentages and reset times. It reports no amounts, so this model has no
 * money in it: a dollar figure would have to be invented to appear here.
 */

export type MeterKind = "five_hour" | "calendar_week" | "product_period";

export const METER_KINDS: MeterKind[] = ["five_hour", "calendar_week", "product_period"];

/** What the console says about one window. */
export interface UsageMeter {
  kind: MeterKind;
  /** 0-100, already clamped. */
  percent: number;
  /** ISO timestamp of the rollover, or null when the window is not open. */
  resetsAt: string | null;
  /** The window's own health, as the page reports it. */
  status: "ok" | "error" | "unknown";
}

export interface UsageSnapshot {
  meters: UsageMeter[];
  /** Timestamp (ms) at which this snapshot was taken. */
  fetchedAt: number;
}

/** Fraction in [0, 1]. Never NaN. */
export function usedFraction(meter: UsageMeter): number {
  if (!Number.isFinite(meter.percent)) {
    return 0;
  }
  return Math.min(1, Math.max(0, meter.percent / 100));
}

export function usedPercent(meter: UsageMeter): number {
  return Math.round(usedFraction(meter) * 100);
}

export type Severity = "ok" | "warn" | "critical";

export function severityOf(meter: UsageMeter): Severity {
  const fraction = usedFraction(meter);
  if (fraction >= 0.95) {
    return "critical";
  }
  if (fraction >= 0.8) {
    return "warn";
  }
  return "ok";
}

/** The meter closest to its limit — what the status bar shows by default. */
export function mostConstrained(meters: UsageMeter[]): UsageMeter | undefined {
  let best: UsageMeter | undefined;
  for (const meter of meters) {
    if (!best || usedFraction(meter) > usedFraction(best)) {
      best = meter;
    }
  }
  return best;
}

/** Meters in a stable display order regardless of the order they were parsed in. */
export function orderedMeters(meters: UsageMeter[]): UsageMeter[] {
  const ordered: UsageMeter[] = [];
  for (const kind of METER_KINDS) {
    const meter = meters.find((m) => m.kind === kind);
    if (meter) {
      ordered.push(meter);
    }
  }
  for (const meter of meters) {
    if (!ordered.includes(meter)) {
      ordered.push(meter);
    }
  }
  return ordered;
}
