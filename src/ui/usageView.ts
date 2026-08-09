import * as vscode from "vscode";

import { formatClock, formatCountdown, meterLabel } from "../format";
import { Lang, strings } from "../i18n";
import { orderedMeters, Severity, severityOf, UsageSnapshot, usedPercent } from "../meters";
import { UsageState } from "../usageStore";

export interface UsageViewConfig {
  lang: Lang;
  consoleUrl: string;
}

interface MeterVM {
  label: string;
  percent: number;
  severity: Severity;
  countdown: string | null;
}

interface SetupVM {
  heading: string;
  hint: string;
  steps: string[];
  connect: string;
}

interface ViewModel {
  kind: UsageState["kind"];
  title: string;
  meters: MeterVM[];
  message: string | null;
  stale: boolean;
  footer: string[];
  /** Present only in the `needsSetup` state. */
  setup: SetupVM | null;
  labels: {
    refresh: string;
    retry: string;
    openConsole: string;
    loading: string;
    staleNotice: string;
  };
}

/** Refresh the rendered countdowns while the panel is on screen. */
const TICK_MS = 30_000;

export class UsageViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  static readonly viewType = "opencodeGo.usageView";

  private view: vscode.WebviewView | undefined;
  private lastState: UsageState = { kind: "loading" };
  private tick: NodeJS.Timeout | undefined;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly getConfig: () => UsageViewConfig,
  ) {}

  dispose(): void {
    this.stopTick();
    for (const d of this.disposables) {
      d.dispose();
    }
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "media")],
    };
    view.webview.html = this.buildHtml(view.webview);

    this.disposables.push(
      view.webview.onDidReceiveMessage((message: { type?: string }) => {
        switch (message?.type) {
          case "refresh":
            void vscode.commands.executeCommand("opencodeGo.refresh");
            break;
          case "connectWorkspace":
            void vscode.commands.executeCommand("opencodeGo.connectWorkspace");
            break;
          case "openConsole":
            void vscode.commands.executeCommand("opencodeGo.openConsole");
            break;
          case "ready":
            this.post();
            break;
        }
      }),
      view.onDidChangeVisibility(() => {
        if (view.visible) {
          this.post();
          this.startTick();
        } else {
          this.stopTick();
        }
      }),
    );

    view.onDidDispose(() => {
      this.view = undefined;
      this.stopTick();
    });

    this.post();
    this.startTick();
  }

  render(state: UsageState): void {
    this.lastState = state;
    this.post();
  }

  private startTick(): void {
    this.stopTick();
    this.tick = setInterval(() => this.post(), TICK_MS);
  }

  private stopTick(): void {
    if (this.tick) {
      clearInterval(this.tick);
      this.tick = undefined;
    }
  }

  private post(): void {
    if (!this.view?.visible) {
      return;
    }
    void this.view.webview.postMessage({ type: "state", payload: this.buildViewModel() });
  }

  private buildViewModel(): ViewModel {
    const { lang } = this.getConfig();
    const s = strings(lang);
    const state = this.lastState;

    const base: ViewModel = {
      kind: state.kind,
      title: s.title,
      meters: [],
      message: null,
      stale: false,
      footer: [],
      setup: null,
      labels: {
        refresh: s.refresh,
        retry: s.retry,
        openConsole: s.openConsole,
        loading: s.loading,
        staleNotice: s.staleNotice,
      },
    };

    switch (state.kind) {
      case "needsSetup":
        return {
          ...base,
          setup: {
            heading: s.setupHeading,
            hint: s.setupHint,
            steps: [s.setupStep1, s.setupStep2, s.setupStep3],
            connect: s.connectWorkspaceButton,
          },
        };

      case "loading":
        if (!state.last) {
          return { ...base, message: s.loading };
        }
        return { ...base, ...this.fromSnapshot(state.last, lang), kind: "loading" };

      case "error":
        if (!state.last) {
          return { ...base, message: state.message };
        }
        return {
          ...base,
          ...this.fromSnapshot(state.last, lang),
          kind: "error",
          message: state.message,
          stale: true,
        };

      case "ready":
        return { ...base, ...this.fromSnapshot(state.snapshot, lang), kind: "ready" };
    }
  }

  private fromSnapshot(snapshot: UsageSnapshot, lang: Lang): Pick<ViewModel, "meters" | "footer"> {
    const meters: MeterVM[] = orderedMeters(snapshot.meters).map((meter) => ({
      label: meterLabel(meter.kind, lang),
      percent: usedPercent(meter),
      severity: severityOf(meter),
      countdown: formatCountdown(meter.resetsAt, lang),
    }));

    return { meters, footer: [formatClock(snapshot.fetchedAt, lang)] };
  }

  private buildHtml(webview: vscode.Webview): string {
    const nonce = makeNonce();
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "media", "view.css"),
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "media", "view.js"),
    );

    return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${styleUri}">
<title>OpenCode Go Usage</title>
</head>
<body>
<main id="root"></main>
<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function makeNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";
  for (let i = 0; i < 32; i++) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return nonce;
}
