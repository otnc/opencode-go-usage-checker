const assert = require("node:assert/strict");
const { test } = require("node:test");
const path = require("node:path");

const OUT = path.join(__dirname, "..", "out");
const ws = require(path.join(OUT, "workspace.js"));
const { usedPercent } = require(path.join(OUT, "meters.js"));

/** The `$R[n]` shape, as the workspace page serialises it. */
const PAGE = `<!DOCTYPE html><html><body><script>
window._$HY={};
rollingUsage:$R[12]={status:"ok",resetInSec:17400,usagePercent:0},
weeklyUsage:$R[13]={status:"ok",resetInSec:114000,usagePercent:0},
monthlyUsage:$R[14]={status:"ok",resetInSec:1590000,usagePercent:50}
</script></body></html>`;

/** The plain-assignment shape. */
const PAGE_PLAIN = `rollingUsage={status:"ok",resetInSec:600,usagePercent:12}
weeklyUsage={status:"ok",resetInSec:60,usagePercent:34}
monthlyUsage={status:"error",resetInSec:0,usagePercent:99}`;

const NOW = Date.parse("2026-08-08T16:18:00.000Z");

test("extracts all three windows from the $R form", () => {
  const meters = ws.parseWorkspaceHtml(PAGE, NOW);

  assert.deepEqual(
    meters.map((m) => m.kind),
    ["five_hour", "calendar_week", "product_period"],
  );
  assert.deepEqual(
    meters.map((m) => m.percent),
    [0, 0, 50],
  );
  // resetInSec is relative; it becomes an absolute instant.
  assert.equal(meters[1].resetsAt, new Date(NOW + 114000 * 1000).toISOString());
});

test("extracts the plain-assignment form too", () => {
  const meters = ws.parseWorkspaceHtml(PAGE_PLAIN, NOW);
  assert.deepEqual(
    meters.map((m) => m.percent),
    [12, 34, 99],
  );
});

test("a zero reset time is treated as unknown rather than as now", () => {
  const meters = ws.parseWorkspaceHtml(PAGE_PLAIN, NOW);
  assert.equal(meters[2].resetsAt, null, "resetInSec:0 carries no information");
});

test("field order inside the object does not matter", () => {
  const meters = ws.parseWorkspaceHtml(
    `monthlyUsage={usagePercent:77,status:"ok",resetInSec:120}`,
    NOW,
  );
  assert.equal(meters.length, 1);
  assert.equal(meters[0].percent, 77);
  assert.equal(meters[0].resetsAt, new Date(NOW + 120000).toISOString());
});

test("scraped meters carry a percentage and nothing money-shaped", () => {
  const [rolling, , monthly] = ws.parseWorkspaceHtml(PAGE, NOW);

  assert.equal(usedPercent(monthly), 50);
  assert.equal(usedPercent(rolling), 0);

  // The page reports no amounts, so the model must not carry any: a zeroed
  // amount field would render as "$0.00" and assert something never measured.
  assert.deepEqual(Object.keys(monthly).sort(), ["kind", "percent", "resetsAt", "status"]);
});

test("the window's own status is preserved", () => {
  const [, , monthly] = ws.parseWorkspaceHtml(PAGE_PLAIN, NOW);
  assert.equal(monthly.status, "error");

  // An unfamiliar status is neither "ok" nor invented — it is unknown.
  const [odd] = ws.parseWorkspaceHtml(
    `rollingUsage={status:"degraded",resetInSec:60,usagePercent:5}`,
    NOW,
  );
  assert.equal(odd.status, "unknown");
});

test("percentages are clamped to a sane range", () => {
  const meters = ws.parseWorkspaceHtml(
    `monthlyUsage={status:"ok",resetInSec:1,usagePercent:250}`,
    NOW,
  );
  assert.equal(meters[0].percent, 100);
});

test("a page with no payload yields nothing rather than zeroes", () => {
  assert.deepEqual(ws.parseWorkspaceHtml("<html><body>Sign in</body></html>", NOW), []);
  // A window without a percentage is not a 0% window.
  assert.deepEqual(ws.parseWorkspaceHtml(`monthlyUsage={status:"ok",resetInSec:60}`, NOW), []);
});

test("normalises a pasted cookie either way round", () => {
  assert.equal(ws.cookieHeader("abc123"), "auth=abc123");
  assert.equal(ws.cookieHeader("auth=abc123"), "auth=abc123");
  assert.equal(ws.cookieHeader("  auth=abc123;  "), "auth=abc123");
});

test("builds the workspace URL", () => {
  assert.equal(ws.workspaceUrl("wrk_01ABC"), "https://opencode.ai/workspace/wrk_01ABC/go");
});

test("a redirect to the auth page is reported as an expired session", async () => {
  const fakeFetch = async () =>
    new Response("", { status: 302, headers: { location: "/auth/authorize" } });

  await assert.rejects(
    () =>
      ws.fetchWorkspaceUsage({ workspaceId: "wrk_01ABC", authCookie: "c" }, undefined, fakeFetch),
    (err) => err instanceof ws.WorkspaceError && err.failure.kind === "unauthorized",
  );
});

test("a 200 that carries the login page is reported as an expired session", async () => {
  const fakeFetch = async () =>
    new Response('<html><a href="/auth/authorize">Sign in</a></html>', { status: 200 });

  await assert.rejects(
    () =>
      ws.fetchWorkspaceUsage({ workspaceId: "wrk_01ABC", authCookie: "c" }, undefined, fakeFetch),
    (err) => {
      assert.ok(err instanceof ws.WorkspaceError);
      assert.equal(err.failure.kind, "noPayload");
      assert.equal(err.failure.sawLogin, true, "must blame the session, not the parser");
      return true;
    },
  );
});

test("missing credentials fail before any request is made", async () => {
  let called = false;
  const fakeFetch = async () => {
    called = true;
    return new Response("", { status: 200 });
  };

  await assert.rejects(
    () => ws.fetchWorkspaceUsage({ workspaceId: "", authCookie: "c" }, undefined, fakeFetch),
    (err) => err instanceof ws.WorkspaceError && err.failure.kind === "noCredentials",
  );
  assert.equal(called, false);
});

test("sends the auth cookie and a browser user agent", async () => {
  let seen;
  const fakeFetch = async (url, init) => {
    seen = { url, headers: init.headers };
    return new Response(PAGE, { status: 200 });
  };

  const meters = await ws.fetchWorkspaceUsage(
    { workspaceId: "wrk_01ABC", authCookie: "cookievalue" },
    undefined,
    fakeFetch,
  );

  assert.equal(seen.url, "https://opencode.ai/workspace/wrk_01ABC/go");
  assert.equal(seen.headers.Cookie, "auth=cookievalue");
  assert.match(seen.headers["User-Agent"], /Mozilla/);
  assert.equal(meters.length, 3);
});

test("prose outside a script tag cannot be mistaken for the payload", () => {
  const page = `<html><body>
    <p>Your monthlyUsage={status:"ok",resetInSec:1,usagePercent:99} explained</p>
    <script>monthlyUsage={status:"ok",resetInSec:60,usagePercent:7}</script>
  </body></html>`;

  const meters = ws.parseWorkspaceHtml(page, NOW);
  assert.equal(meters.length, 1);
  assert.equal(meters[0].percent, 7, "the script body wins over body text");
});

test("a page with no script tags still gets parsed", () => {
  // Falling back to the whole document keeps a markup change from reading as
  // an empty page, which would be reported as a dead session.
  const meters = ws.parseWorkspaceHtml(
    `monthlyUsage={status:"ok",resetInSec:60,usagePercent:7}`,
    NOW,
  );
  assert.equal(meters.length, 1);
});
