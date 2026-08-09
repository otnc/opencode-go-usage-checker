/**
 * Reads usage from the workspace console at
 * `https://opencode.ai/workspace/<wrk_…>/go`.
 *
 * Why this exists: `opencode.ai` serves no REST API at all — the page is a
 * SolidStart app whose data arrives through server functions. What it *does*
 * do is serialise the resolved values into the delivered HTML, so the numbers
 * the screen shows are readable from the markup:
 *
 *     rollingUsage:$R[12]={status:"ok",resetInSec:17400,usagePercent:42}
 *
 * That makes this a scrape, with everything that implies: it is authenticated
 * by the browser's own session cookie rather than a token, and a redesign of
 * the page will break it. Every failure here is typed so the UI can say which
 * of those happened instead of showing a bare zero.
 */

import { MeterKind, UsageMeter } from "./meters";

/** The three window names as the page serialises them. */
const WINDOW_KEYS: { key: string; kind: MeterKind }[] = [
  { key: "rollingUsage", kind: "five_hour" },
  { key: "weeklyUsage", kind: "calendar_week" },
  { key: "monthlyUsage", kind: "product_period" },
];

export type WorkspaceFailure =
  | { kind: "noCredentials" }
  | { kind: "timeout" }
  | { kind: "network"; detail: string }
  /** The session cookie is missing, expired, or was rejected. */
  | { kind: "unauthorized" }
  | { kind: "http"; status: number }
  /** The page loaded but carried no usage payload — a redesign, or a login wall. */
  | { kind: "noPayload"; sawLogin: boolean };

export class WorkspaceError extends Error {
  constructor(readonly failure: WorkspaceFailure) {
    super(failure.kind);
    this.name = "WorkspaceError";
  }
}

export interface WorkspaceCredentials {
  workspaceId: string;
  /** The `auth` cookie value, with or without the leading `auth=`. */
  authCookie: string;
}

const REQUEST_TIMEOUT_MS = 20_000;

/**
 * A browser User-Agent. The console is a normal web page and answers requests
 * that look like a browser; this is not an attempt to hide what we are.
 */
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export function workspaceUrl(workspaceId: string, origin = "https://opencode.ai"): string {
  return `${origin.replace(/\/+$/, "")}/workspace/${encodeURIComponent(workspaceId)}/go`;
}

/** Normalises a pasted cookie into a `Cookie:` header value. */
export function cookieHeader(authCookie: string): string {
  const trimmed = authCookie.trim().replace(/;$/, "");
  return /^auth=/.test(trimmed) ? trimmed : `auth=${trimmed}`;
}

/** Fetches the workspace page and extracts its three usage windows. */
export async function fetchWorkspaceUsage(
  credentials: WorkspaceCredentials,
  origin?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<UsageMeter[]> {
  if (!credentials.workspaceId.trim() || !credentials.authCookie.trim()) {
    throw new WorkspaceError({ kind: "noCredentials" });
  }

  const url = workspaceUrl(credentials.workspaceId.trim(), origin);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: {
        Cookie: cookieHeader(credentials.authCookie),
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
      // A redirect to /auth/authorize is the signal that the cookie is dead —
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

  const html = await response.text();
  const meters = parseWorkspaceHtml(html);
  if (meters.length === 0) {
    // Being served the login page with a 200 is the common way for an expired
    // cookie to present itself, so name that case rather than blaming the parser.
    const sawLogin = /\/auth\/authorize|sign\s?in to opencode/i.test(html);
    throw new WorkspaceError({ kind: "noPayload", sawLogin });
  }
  return meters;
}

/**
 * Pulls the serialised windows out of the page.
 *
 * Two shapes are in circulation — a `$R[n]` reference and a plain assignment —
 * and the key order inside the object is not guaranteed, so each field is
 * matched independently within the braces that follow the window's name.
 *
 * The search is confined to `<script>` bodies. A DOM library would buy nothing
 * here: the numbers are not in the markup, they are in serialised JavaScript,
 * and cheerio would only be a heavier way to reach the same script text. What
 * scoping does buy is that prose containing the word "monthlyUsage" cannot be
 * mistaken for the payload.
 */
export function parseWorkspaceHtml(html: string, now = Date.now()): UsageMeter[] {
  const meters: UsageMeter[] = [];
  const haystack = scriptBodies(html) || html;

  for (const { key, kind } of WINDOW_KEYS) {
    const body = findObjectBody(haystack, key);
    if (body === null) {
      continue;
    }

    const percent = readNumber(body, "usagePercent");
    if (percent === null) {
      continue;
    }
    const resetInSec = readNumber(body, "resetInSec") ?? readNumber(body, "resetsInSeconds");

    meters.push({
      kind,
      percent: Math.min(100, Math.max(0, percent)),
      resetsAt:
        resetInSec !== null && resetInSec > 0
          ? new Date(now + resetInSec * 1000).toISOString()
          : null,
      status: readStatus(body),
    });
  }

  return meters;
}

/** The window's own `status:"…"`, narrowed to what we know how to show. */
function readStatus(body: string): UsageMeter["status"] {
  const match = /status\s*:\s*"([^"]*)"/.exec(body);
  const value = match?.[1];
  return value === "ok" || value === "error" ? value : "unknown";
}

/**
 * Every `<script>` body joined together, or "" when the page has none — in
 * which case the caller falls back to the whole document rather than deciding
 * the page is empty.
 */
function scriptBodies(html: string): string {
  const bodies: string[] = [];
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    bodies.push(match[1]);
  }
  return bodies.join("\n");
}

/** The `{…}` that follows `<key>=` or `<key>:$R[n]=`, or null. */
function findObjectBody(html: string, key: string): string | null {
  const pattern = new RegExp(`${key}\\s*(?::\\s*\\$R\\[\\d+\\]\\s*)?=\\s*\\{([^{}]*)\\}`);
  return pattern.exec(html)?.[1] ?? null;
}

function readNumber(body: string, field: string): number | null {
  const match = new RegExp(`${field}\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`).exec(body);
  if (!match) {
    return null;
  }
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}
