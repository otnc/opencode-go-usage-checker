# OpenCode Go Usage

OpenCode Go の使用量制限 — **ローリング5時間 / 週間 / 月間** — を VS Code のステータスバーで
確認できます。ブラウザでコンソールを開かなくても、いま何割使っていて、あとどれくらいで回復するのかが
分かります。

English version: [README.md](README.md)

```
ステータスバー:  $(pulse) Go Usage 5時間 62%

パネル:
  ローリング 5時間
  ████████░░░░  62%
  あと 1時間12分で回復

  週間
  ███░░░░░░░░░  31%
  あと 3日4時間で回復

  月間
  █████░░░░░░░  44%
  あと 12日で回復
```

## 機能

- **常に見える。** ステータスバーにはデフォルトでローリング5時間枠を表示します。`auto` にすると
  最も逼迫している枠が表示されます。70% で黄、90% で赤に変わります。
- **3枠まとめて確認。** ステータスバーをクリックするとパネルが開きます（ホバーならツールチップ）。
  各枠のバーと、回復までのカウントダウンが並びます。
- **放っておいても最新。** 5分ごと、およびウィンドウに戻ったときに更新します。VS Code が
  バックグラウンドの間はポーリングを止めます。
- **英語と日本語**に対応。`auto` にすると VS Code の表示言語に追従します。

## インストール

VS Code Marketplace から **OpenCode Go Usage Checker** をインストールするか、次を実行します。

```
code --install-extension otoneko1102.opencode-go-usage-checker
```

## セットアップ

**OpenCode Go: workspace を接続**（またはパネルのボタン）を実行し、次の2つを入力します。

1. **workspace ID。** サインイン済みの状態で opencode.ai の workspace を開き、アドレスバーの
   `wrk_…` の部分をコピーします: `opencode.ai/workspace/`**`wrk_…`**`/go`
2. **`auth` クッキー。** そのページを開いたまま <kbd>F12</kbd> → Application → Storage →
   Cookies → `https://opencode.ai` を選び、`auth` という行の **Value** をコピーします。

クッキーは VS Code の SecretStorage に保存され、設定ファイルには書き込みません。workspace ID は
通常の設定項目です。**OpenCode Go: workspace の接続を解除** で両方を破棄できます。

クッキーはブラウザのセッションなので、いずれ期限が切れます。切れたときはパネルがその旨を明示するので、
新しいクッキーで接続し直してください。

## コマンド

| コマンド | 説明 |
| --- | --- |
| `OpenCode Go: 使用量を表示` | パネルを開く（ステータスバーのクリック先） |
| `OpenCode Go: 使用量を更新` | 手動で再取得 |
| `OpenCode Go: workspace を接続…` | workspace ID と auth クッキーを設定 |
| `OpenCode Go: workspace の接続を解除` | 両方を破棄 |
| `OpenCode Go: コンソールをブラウザで開く` | workspace のページを開く |
| `OpenCode Go: 診断情報を表示` | ページから取れた内容と、解析した数値を並べて出力 |

## 設定

| 設定 | 既定値 | 説明 |
| --- | --- | --- |
| `opencodeGo.language` | `auto` | パネルとツールチップの言語。`auto` は VS Code の表示言語に追従 |
| `opencodeGo.statusBar.enabled` | `true` | ステータスバー表示のオン/オフ |
| `opencodeGo.statusBar.meter` | `five_hour` | 表示する枠: `five_hour` / `calendar_week` / `product_period` / `auto`（最も逼迫している枠） |
| `opencodeGo.refreshInterval` | `300` | 自動更新の間隔（秒）。`0` で無効。60 未満は 60 に切り上げ |
| `opencodeGo.workspaceId` | *(空)* | 取得対象の `wrk_…`。**workspace を接続**で設定 |
| `opencodeGo.baseUrl` | `https://opencode.ai` | コンソールのオリジン。別デプロイを見る場合のみ変更 |

## 仕組みと、その代償

OpenCode には公式な使用量 API がありません。`opencode.ai` は `/api/*` を一切提供しておらず、
`/workspace/<wrk_…>/go` の画面は SolidStart のアプリで、データはサーバー関数経由で届きます。
ただし、解決済みの値は配信される HTML にシリアライズされて埋め込まれています。

```
rollingUsage:$R[12]={status:"ok",resetInSec:17400,usagePercent:42}
```

そこでこの拡張機能は、あなたのセッションクッキーでそのページを取得し、そこから数値を読み出します。
これは **スクレイピング** であり、当然の帰結として次の制約があります。

- 取得できるのは **% とリセット時刻だけ** です。ページに金額が含まれないため、この拡張機能も
  金額を表示しません。捏造することになるからです。
- **ページの構造が変われば壊れます。** そのときは「使用量の値が含まれていなかった」と表示します。
  自信ありげにゼロを出すことはしません。
- **ブラウザのセッションクッキー** に依存するため、いずれ期限が切れます。

セッション切れとページ構造の変化は、別々のエラーとして報告します。前者は新しいクッキー、後者は
パーサの修正が必要で、対処が違うためです。

## ライセンス

MIT — [LICENSE](LICENSE) を参照してください。
