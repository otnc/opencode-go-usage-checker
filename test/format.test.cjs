const assert = require("node:assert/strict");
const { test } = require("node:test");
const path = require("node:path");

const OUT = path.join(__dirname, "..", "out");
const f = require(path.join(OUT, "format.js"));
const m = require(path.join(OUT, "meters.js"));
const i18n = require(path.join(OUT, "i18n", "index.js"));

const meter = (kind, percent, resetsAt = null) => ({
  kind,
  percent,
  resetsAt,
  status: "ok",
});

const SAMPLE = [
  meter("five_hour", 62, "2026-08-08T14:00:00Z"),
  meter("calendar_week", 31, "2026-08-10T00:00:00Z"),
  meter("product_period", 44),
];

test("orders meters consistently and picks the most constrained one", () => {
  const kinds = ["five_hour", "calendar_week", "product_period"];

  assert.equal(m.mostConstrained(SAMPLE).kind, "five_hour");
  assert.deepEqual(
    m.orderedMeters(SAMPLE).map((x) => x.kind),
    kinds,
  );
  // Order is normalised even if the page yields them shuffled.
  assert.deepEqual(
    m.orderedMeters([SAMPLE[2], SAMPLE[0], SAMPLE[1]]).map((x) => x.kind),
    kinds,
  );
  assert.equal(m.mostConstrained([]), undefined);
});

test("severity crosses at 80% and 95%", () => {
  assert.equal(m.severityOf(meter("five_hour", 79)), "ok");
  assert.equal(m.severityOf(meter("five_hour", 80)), "warn");
  assert.equal(m.severityOf(meter("five_hour", 94)), "warn");
  assert.equal(m.severityOf(meter("five_hour", 95)), "critical");
});

test("percentages are clamped and never NaN", () => {
  assert.equal(m.usedFraction(meter("five_hour", 500)), 1);
  assert.equal(m.usedFraction(meter("five_hour", -20)), 0);
  assert.equal(m.usedFraction(meter("five_hour", NaN)), 0);
  assert.equal(m.usedPercent(meter("five_hour", 62.4)), 62);
});

test("formats countdowns in both languages", () => {
  const now = Date.parse("2026-08-08T12:00:00Z");
  const en = (iso) => f.formatCountdown(iso, "en", now);
  const ja = (iso) => f.formatCountdown(iso, "ja", now);

  assert.equal(en("2026-08-08T13:12:00Z"), "resets in 1h 12m");
  assert.equal(en("2026-08-08T14:00:00Z"), "resets in 2h");
  assert.equal(en("2026-08-08T12:00:30Z"), "resets in 1m");
  assert.equal(en("2026-08-11T16:00:00Z"), "resets in 3d 4h");
  assert.equal(en("2026-08-20T12:00:00Z"), "resets in 12d");
  assert.equal(en("2026-08-08T11:00:00Z"), "resetting now");

  assert.equal(ja("2026-08-08T13:12:00Z"), "あと 1時間12分で回復");
  assert.equal(ja("2026-08-08T14:00:00Z"), "あと 2時間で回復");
  assert.equal(ja("2026-08-08T12:00:30Z"), "あと 1分で回復");
  assert.equal(ja("2026-08-11T16:00:00Z"), "あと 3日4時間で回復");
  assert.equal(ja("2026-08-20T12:00:00Z"), "あと 12日で回復");
  assert.equal(ja("2026-08-08T11:00:00Z"), "まもなく回復");

  // A window that has not opened has no countdown, and a broken date is not one either.
  assert.equal(f.formatCountdown(null, "ja"), null);
  assert.equal(f.formatCountdown("not-a-date", "ja"), null);

  // An unrecognised language falls back to English rather than blowing up.
  assert.equal(f.formatCountdown("2026-08-08T13:12:00Z", "fr", now), "resets in 1h 12m");
});

test("labels resolve per language", () => {
  assert.equal(f.meterLabel("five_hour", "en"), "Rolling 5 hours");
  assert.equal(f.meterLabel("five_hour", "ja"), "ローリング 5時間");
  assert.equal(f.meterShortLabel("calendar_week", "en"), "Week");
  assert.equal(f.meterShortLabel("calendar_week", "ja"), "週");
  assert.equal(i18n.strings("en").refresh, "Refresh");
  assert.equal(i18n.strings("ja").refresh, "更新");
});

test("language setting resolves to a registered locale, defaulting to English", () => {
  assert.equal(i18n.DEFAULT_LANG, "en");
  assert.equal(i18n.toLang("ja"), "ja");
  assert.equal(i18n.toLang("en"), "en");
  assert.equal(i18n.toLang(undefined), "en");
  assert.equal(i18n.toLang(""), "en");
  // An explicit language with no bundle falls back rather than showing keys.
  // "zz" is not a real language code, so this stays true as locales are added.
  assert.equal(i18n.toLang("zz"), "en");
  // Region subtags resolve to the base language in either direction.
  assert.equal(i18n.toLang("ja-JP"), "ja");
  assert.equal(i18n.toLang("JA"), "ja");
  assert.equal(i18n.toLang("en-GB"), "en");
});

test("auto follows the VS Code display language", () => {
  assert.equal(i18n.toLang("auto", "ja"), "ja");
  assert.equal(i18n.toLang("auto", "ja-jp"), "ja");
  assert.equal(i18n.toLang("auto", "en-US"), "en");
  // Unsupported editor language, and a missing one, both fall back.
  assert.equal(i18n.toLang("auto", "zz"), "en");
  assert.equal(i18n.toLang("auto", undefined), "en");
  // An explicit choice always wins over the editor language.
  assert.equal(i18n.toLang("en", "ja"), "en");
  assert.equal(i18n.toLang("ja", "en-US"), "ja");
});

test("a partial locale bundle inherits the untranslated keys from English", () => {
  const { EN } = require(path.join(OUT, "i18n", "en.js"));

  // A bundle that translates exactly one key and one nested entry.
  const sparse = i18n.LOCALES.find((l) => l.code === "sparse-test");
  assert.equal(sparse, undefined, "the registry should not ship a test locale");

  i18n.LOCALES.push({
    code: "sparse-test",
    label: "Sparse",
    bundle: { refresh: "TRANSLATED", meterLabel: { calendar_week: "SEMANA" } },
  });
  try {
    const s = i18n.strings("sparse-test");
    assert.equal(s.refresh, "TRANSLATED", "translated key is used");
    assert.equal(s.retry, EN.retry, "untranslated key falls back to English");
    assert.equal(s.meterLabel.calendar_week, "SEMANA", "translated meter label is used");
    assert.equal(
      s.meterLabel.five_hour,
      EN.meterLabel.five_hour,
      "untranslated meter label falls back",
    );
    assert.equal(typeof s.resetsIn, "function", "inherited functions stay callable");
    assert.equal(s.resetsIn(0, 1, 12), EN.resetsIn(0, 1, 12));
  } finally {
    i18n.LOCALES.splice(
      i18n.LOCALES.findIndex((l) => l.code === "sparse-test"),
      1,
    );
  }
});

test("renders workspace failures as messages in the chosen language", () => {
  const { WorkspaceError } = require(path.join(OUT, "workspace.js"));
  const err = (failure) => new WorkspaceError(failure);

  assert.match(f.describeError(err({ kind: "timeout" }), "en"), /timed out/);
  assert.match(f.describeError(err({ kind: "timeout" }), "ja"), /タイムアウト/);
  assert.equal(
    f.describeError(err({ kind: "network", detail: "ECONNRESET" }), "en"),
    "Could not connect: ECONNRESET",
  );
  assert.match(f.describeError(err({ kind: "http", status: 503 }), "en"), /HTTP 503/);

  // An expired session must read as an expired session, whichever way it presents.
  assert.match(f.describeError(err({ kind: "unauthorized" }), "en"), /session has expired/);
  assert.match(
    f.describeError(err({ kind: "noPayload", sawLogin: true }), "ja"),
    /セッションが切れて/,
  );
  // …but a page that simply had no payload must not be blamed on the session.
  assert.match(
    f.describeError(err({ kind: "noPayload", sawLogin: false }), "en"),
    /no usage figures/,
  );
  assert.match(f.describeError(err({ kind: "noCredentials" }), "en"), /Connect a workspace/);

  // Non-typed throwables still surface something readable.
  assert.equal(f.describeError(new Error("boom"), "en"), "boom");
  assert.equal(f.describeError("boom", "en"), "boom");
});
