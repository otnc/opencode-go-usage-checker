import * as vscode from "vscode";

import { describeError } from "./format";
import { Lang } from "./i18n";
import { UsageSnapshot } from "./meters";
import { fetchWorkspaceUsage } from "./workspace";
import { WorkspaceCredentialStore } from "./workspaceCredentials";

export type UsageState =
  | { kind: "loading"; last?: UsageSnapshot }
  /** No workspace is connected yet — the panel shows the setup steps. */
  | { kind: "needsSetup" }
  | { kind: "ready"; snapshot: UsageSnapshot }
  | { kind: "error"; message: string; last?: UsageSnapshot };

export interface UsageStoreConfig {
  origin: string;
  refreshIntervalSeconds: number;
  lang: Lang;
}

/** Don't re-fetch on window focus more often than this. */
const FOCUS_THROTTLE_MS = 30_000;

/**
 * Owns the current usage snapshot: fetching, polling, and the "refresh when the
 * window regains focus" behaviour. UI components subscribe to `onDidChange` and
 * render whatever `state` says — they never fetch themselves.
 */
export class UsageStore implements vscode.Disposable {
  private _state: UsageState = { kind: "loading" };
  private lastGood: UsageSnapshot | undefined;
  private timer: NodeJS.Timeout | undefined;
  private lastFetchAt = 0;
  private refreshing: Promise<void> | undefined;
  private readonly disposables: vscode.Disposable[] = [];
  private readonly onChange = new vscode.EventEmitter<UsageState>();

  readonly onDidChange = this.onChange.event;

  constructor(
    private readonly workspace: WorkspaceCredentialStore,
    private readonly getConfig: () => UsageStoreConfig,
  ) {
    this.disposables.push(
      vscode.window.onDidChangeWindowState((windowState) => {
        if (windowState.focused) {
          this.scheduleTimer();
          if (Date.now() - this.lastFetchAt > FOCUS_THROTTLE_MS) {
            void this.refresh();
          }
        } else {
          this.clearTimer();
        }
      }),
    );
  }

  get state(): UsageState {
    return this._state;
  }

  dispose(): void {
    this.clearTimer();
    this.onChange.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }

  start(): void {
    this.scheduleTimer();
    void this.refresh();
  }

  /** Re-reads configuration that affects polling. */
  reconfigure(): void {
    this.scheduleTimer();
  }

  private clearTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private scheduleTimer(): void {
    this.clearTimer();
    const seconds = this.getConfig().refreshIntervalSeconds;
    if (seconds <= 0 || !vscode.window.state.focused) {
      return;
    }
    // Anything under a minute would hammer a page that updates far more slowly.
    const intervalMs = Math.max(60, seconds) * 1000;
    this.timer = setInterval(() => void this.refresh(), intervalMs);
  }

  async refresh(): Promise<void> {
    if (!this.refreshing) {
      this.refreshing = this.doRefresh().finally(() => {
        this.refreshing = undefined;
      });
    }
    return this.refreshing;
  }

  private async doRefresh(): Promise<void> {
    const { origin, lang } = this.getConfig();
    this.setState({ kind: "loading", last: this.lastGood });

    const credentials = await this.workspace.get();
    if (!credentials) {
      // Not an error: nothing has gone wrong, the extension just has not been
      // told which workspace to read yet.
      this.lastGood = undefined;
      this.setState({ kind: "needsSetup" });
      return;
    }

    try {
      const meters = await fetchWorkspaceUsage(credentials, origin);
      this.lastFetchAt = Date.now();
      this.lastGood = { meters, fetchedAt: Date.now() };
      this.setState({ kind: "ready", snapshot: this.lastGood });
    } catch (err) {
      this.setState({ kind: "error", message: describeError(err, lang), last: this.lastGood });
    }
  }

  private setState(state: UsageState): void {
    this._state = state;
    this.onChange.fire(state);
  }
}
