const assert = require("node:assert/strict");
const { test } = require("node:test");
const path = require("node:path");

const OUT = path.join(__dirname, "..", "out");
const ws = require(path.join(OUT, "workspace.js"));
const { usedPercent } = require(path.join(OUT, "meters.js"));

const MC = 1_000_000;
const NOW = Date.parse("2026-08-08T16:18:00.000Z");
const iso = (sec) => new Date(NOW + sec * 1000).toISOString();

/** The /console/api/go/status response. */
const STATUS = {
  access: {
    meters: {
      fiveHour: { resetsAt: iso(17400), limitMicroCents: 12 * MC, usedMicroCents: 3 * MC },
      week: {
        startsAt: iso(-1),
        resetsAt: iso(114000),
        limitMicroCents: 30 * MC,
        usedMicroCents: 0,
      },
      month: { limitMicroCents: 60 * MC, usedMicroCents: 30 * MC },
    },
  },
};
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

test("extracts all three windows and derives percentages", () => {
  const meters = ws.parseWorkspaceStatus(STATUS, NOW);
  assert.deepEqual(
    meters.map((m) => m.kind),
    ["five_hour", "calendar_week", "product_period"],
  );
  assert.deepEqual(
    meters.map((m) => m.percent),
    [25, 0, 50],
  );
  assert.equal(meters[0].resetsAt, iso(17400));
  assert.equal(meters[2].resetsAt, null, "the month meter reports no reset time");
});

test("scraped meters carry a percentage and nothing money-shaped", () => {
  const [rolling, , monthly] = ws.parseWorkspaceStatus(STATUS, NOW);
  assert.equal(usedPercent(monthly), 50);
  assert.equal(usedPercent(rolling), 25);
  assert.deepEqual(Object.keys(monthly).sort(), ["kind", "percent", "resetsAt", "status"]);
});

test("amounts given as strings are accepted and percentages are clamped", () => {
  const [m] = ws.parseWorkspaceStatus(
    { access: { meters: { month: { limitMicroCents: "100", usedMicroCents: "250" } } } },
    NOW,
  );
  assert.equal(m.percent, 100);
});

test("a past reset time is treated as unknown rather than as now", () => {
  const [m] = ws.parseWorkspaceStatus(
    { access: { meters: { week: { resetsAt: iso(-5), limitMicroCents: 10, usedMicroCents: 1 } } } },
    NOW,
  );
  assert.equal(m.resetsAt, null);
});

test("a response with no usable meters yields nothing rather than zeroes", () => {
  assert.deepEqual(ws.parseWorkspaceStatus({}, NOW), []);
  assert.deepEqual(ws.parseWorkspaceStatus({ access: null }, NOW), []);
  // A window without a limit is not a 0% window.
  assert.deepEqual(
    ws.parseWorkspaceStatus(
      { access: { meters: { month: { limitMicroCents: 0, usedMicroCents: 0 } } } },
      NOW,
    ),
    [],
  );
});

test("normalises a pasted cookie either way round", () => {
  assert.equal(ws.cookieHeader("abc123"), "__Host-console_session=abc123");
  assert.equal(ws.cookieHeader("console_session=abc123"), "console_session=abc123");
  assert.equal(
    ws.cookieHeader("  __Host-console_session=abc123;  "),
    "__Host-console_session=abc123",
  );
});

test("builds the page and endpoint URLs", () => {
  assert.equal(ws.workspaceUrl("wrk_01ABC"), "https://opencode.ai/console/wrk_01ABC/go");
  assert.equal(ws.statusUrl(), "https://opencode.ai/console/api/go/status");
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

test("a 401 is reported as an expired session", async () => {
  const fakeFetch = async () => json({ _tag: "Unauthorized" }, 401);
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

test("sends the session cookie and the workspace as x-org-id", async () => {
  let seen;
  const fakeFetch = async (url, init) => {
    seen = { url, headers: init.headers };
    return json(STATUS);
  };

  const meters = await ws.fetchWorkspaceUsage(
    { workspaceId: "wrk_01ABC", authCookie: "cookievalue" },
    undefined,
    fakeFetch,
  );

  assert.equal(seen.url, "https://opencode.ai/console/api/go/status");
  assert.equal(seen.headers.Cookie, "__Host-console_session=cookievalue");
  assert.equal(seen.headers["x-org-id"], "wrk_01ABC");
  assert.equal(meters.length, 3);
});
