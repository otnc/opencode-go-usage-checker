import { LocaleBundle } from "./types";

/**
 * Japanese. A `LocaleBundle` may omit any key — anything not listed here falls
 * back to the English value in `en.ts`.
 */
export const JA: LocaleBundle = {
  refresh: "更新",
  retry: "再試行",
  openConsole: "コンソールを開く",
  loading: "読み込み中…",
  fetchFailed: "使用量を取得できませんでした",
  staleNotice: "以下は最後に取得できた値です。",

  meterLabel: {
    five_hour: "ローリング 5時間",
    calendar_week: "週間",
    product_period: "月間",
  },
  meterShortLabel: {
    five_hour: "5時間",
    calendar_week: "週",
    product_period: "月",
  },

  errTimeout: "タイムアウトしました",
  errNetwork: (detail) => `接続できませんでした: ${detail}`,
  errHttp: (status) => `コンソールが HTTP ${status} を返しました。`,

  wsNoCredentials: "workspace を接続すると使用量を表示できます。",
  wsCookieExpired:
    "workspace のセッションが切れています。ブラウザで opencode.ai にサインインし直し、" +
    "新しい auth クッキーで接続をやり直してください。",
  wsNoPayload:
    "workspace のページは取得できましたが、使用量の値が含まれていませんでした。" +
    "ページの構造が変わった可能性があります。",

  setupHeading: "まだ接続されていません",
  setupHint:
    "使用量は workspace のコンソール画面から読み取ります。そのため workspace ID と、" +
    "対応するブラウザのセッションクッキーが必要です。順番に入力を求めます。",
  setupStep1: "1. ブラウザでサインイン済みの workspace を開く",
  setupStep2: "2. アドレスバーから wrk_… の ID をコピー",
  setupStep3: "3. DevTools で `auth` クッキーをコピー",
  connectWorkspaceButton: "workspace を接続",

  wsConfigureTitle: "OpenCode Go: workspace を接続",
  wsWorkspaceIdPrompt:
    "Workspace ID — ブラウザで opencode.ai を開いて workspace に移動し、" +
    "アドレスバーの wrk_… の部分をコピーしてください: opencode.ai/workspace/WRK_ID/go",
  wsWorkspaceIdPlaceholder: "wrk_01ABCDEFGHIJKLMNOPQRSTUVWX",
  wsWorkspaceIdInvalid: "workspace ID の形式ではありません（wrk_… を想定しています）。",
  wsCookiePrompt: "opencode.ai の `auth` クッキーの値",
  wsCookiePlaceholder: "クッキーの値を貼り付け",
  wsCookieRequired: "auth クッキーの値を貼り付けてください。",
  wsHowTo:
    "サインイン済みの opencode.ai を開いた状態で F12 → Application → Storage → Cookies → " +
    "https://opencode.ai を選び、`auth` という行の Value をコピーしてください。" +
    "値は VS Code の SecretStorage に保存され、設定ファイルには書き込みません。",
  wsConfigured: (workspaceId) => `OpenCode Go: ${workspaceId} から使用量を取得します。`,
  wsCleared: "OpenCode Go: workspace の接続を解除しました。",

  resetsNow: "まもなく回復",
  resetsIn: (days, hours, minutes) => {
    if (days > 0) {
      return hours > 0 ? `あと ${days}日${hours}時間で回復` : `あと ${days}日で回復`;
    }
    if (hours > 0) {
      return minutes > 0 ? `あと ${hours}時間${minutes}分で回復` : `あと ${hours}時間で回復`;
    }
    return `あと ${Math.max(1, minutes)}分で回復`;
  },
  updatedAt: (clock) => `${clock} 更新`,
};
