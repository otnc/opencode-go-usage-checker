/**
 * Reads usage from the workspace console.
 *
 * The console used to be a server-rendered page whose HTML carried the numbers.
 * It is now a client-rendered app (`/console/<wrk_…>/go`) that loads them from
 * a JSON endpoint, so the extension calls that endpoint directly:
 *
 *     GET /console/api/go/status        x-org-id: wrk_…
 *     { access: { meters: { fiveHour, week, month } } }
 *
 * Each meter carries `usedMicroCents` and `limitMicroCents`; the percentage is
 * derived from them. The endpoint is internal and undocumented, so a change to
 * it will break this. Every failure here is typed so the UI can say which
 * happened instead of showing a bare zero.
 *
 * Authentication is the console's own session cookie (`console_session`, or
 * `__Host-console_session` over https), not a token.
 */

import { MeterKind, UsageMeter } from "./meters";

const WINDOWS: { key: string; kind: MeterKind }[] = [
  { key: "fiveHour", kind: "five_hour" },
  { key: "week", kind: "calendar_week" },
  { key: "month", kind: "product_period" },
];

export type WorkspaceFailure =
  | { kind: "noCredentials" }
  | { kind: "timeout" }
  | { kind: "network"; detail: string }
  /** The session cookie is missing, expired, or was rejected. */
  | { kind: "unauthorized" }
  | { kind: "http"; status: number }
  /** The endpoint answered but carried no usage figures — a changed response, or no active Go plan. */
  | { kind: "noPayload"; sawLogin: boolean };

export class WorkspaceError extends Error {
  constructor(readonly failure: WorkspaceFailure) {
    super(failure.kind);
    this.name = "WorkspaceError";
  }
}

export interface WorkspaceCredentials {
  workspaceId: string;
  /** The session cookie value, or a full `name=value` pair. */
  authCookie: string;
}

const REQUEST_TIMEOUT_MS = 20_000;

const SESSION_COOKIE = "__Host-console_session";

/** The page a person opens in the browser. */
export function workspaceUrl(workspaceId: string, origin = "https://opencode.ai"): string {
  return `${origin.replace(/\/+$/, "")}/console/${encodeURIComponent(workspaceId)}/go`;
}

/** The JSON endpoint the console page itself reads. */
export function statusUrl(origin = "https://opencode.ai"): string {
  return `${origin.replace(/\/+$/, "")}/console/api/go/status`;
}

/** Normalises a pasted cookie into a `Cookie:` header value. */
export function cookieHeader(authCookie: string): string {
  const trimmed = authCookie.trim().replace(/;$/, "");
  return trimmed.includes("=") ? trimmed : `${SESSION_COOKIE}=${trimmed}`;
}

/** Fetches the workspace status and extracts its three usage windows. */
export async function fetchWorkspaceUsage(
  credentials: WorkspaceCredentials,
  origin?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<UsageMeter[]> {
  if (!credentials.workspaceId.trim() || !credentials.authCookie.trim()) {
    throw new WorkspaceError({ kind: "noCredentials" });
  }

  const url = statusUrl(origin);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: {
        Cookie: cookieHeader(credentials.authCookie),
        "x-org-id": credentials.workspaceId.trim(),
        Accept: "application/json",
      },
      signal: controller.signal,
      // A redirect to the auth page is the signal that the cookie is dead —
      // following it would turn that into an unhelpful 200.
      redirect: "manual",
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new WorkspaceError({ kind: "timeout" });
    }
    throw new WorkspaceError({
      kind: "network",
      detail: err instanceof Error ? err.message : String(err),
    });
  } finally {
    clearTimeout(timer);
  }

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location") ?? "";
    if (/auth|login|sign-?in/i.test(location)) {
      throw new WorkspaceError({ kind: "unauthorized" });
    }
    throw new WorkspaceError({ kind: "http", status: response.status });
  }
  if (response.status === 401 || response.status === 403) {
    throw new WorkspaceError({ kind: "unauthorized" });
  }
  if (!response.ok) {
    throw new WorkspaceError({ kind: "http", status: response.status });
  }

  const text = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    // A 200 that is not JSON is the login page or a changed route. Only the
    // former is the session's fault.
    throw new WorkspaceError({
      kind: "noPayload",
      sawLogin: /\/auth\/authorize|sign\s?in to opencode/i.test(text),
    });
  }

  const meters = parseWorkspaceStatus(body);
  if (meters.length === 0) {
    throw new WorkspaceError({ kind: "noPayload", sawLogin: false });
  }
  return meters;
}

/**
 * Turns the status response into meters. A window without a positive limit has
 * no meaningful percentage, so it is left out rather than shown as 0%.
 */
export function parseWorkspaceStatus(body: unknown, now = Date.now()): UsageMeter[] {
  const windows = asRecord(asRecord(asRecord(body)?.access)?.meters);
  if (!windows) {
    return [];
  }

  const meters: UsageMeter[] = [];
  for (const { key, kind } of WINDOWS) {
    const w = asRecord(windows[key]);
    const used = toNumber(w?.usedMicroCents);
    const limit = toNumber(w?.limitMicroCents);
    if (!w || used === null || limit === null || limit <= 0) {
      continue;
    }

    const resetsAt = typeof w.resetsAt === "string" ? Date.parse(w.resetsAt) : NaN;
    meters.push({
      kind,
      percent: Math.min(100, Math.max(0, (used / limit) * 100)),
      resetsAt:
        Number.isFinite(resetsAt) && resetsAt > now ? new Date(resetsAt).toISOString() : null,
      status: "ok",
    });
  }
  return meters;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

/** Amounts may arrive as numbers or as numeric strings. */
function toNumber(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
