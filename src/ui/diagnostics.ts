import * as vscode from "vscode";

import { describeError, formatCountdown, meterLabel } from "../format";
import { Lang } from "../i18n";
import { orderedMeters, usedPercent } from "../meters";
import { fetchWorkspaceUsage, workspaceUrl } from "../workspace";
import { WorkspaceCredentialStore } from "../workspaceCredentials";

export interface DiagnosticsConfig {
  origin: string;
  lang: Lang;
}

/**
 * Dumps what the workspace page yielded, next to what this extension made of it.
 *
 * This exists because "the numbers look wrong" and "nothing appears" are
 * invisible from the rendered UI: both look like an empty panel. The cookie is
 * reported by length only, never by value.
 */
export class Diagnostics implements vscode.Disposable {
  private channel: vscode.OutputChannel | undefined;

  constructor(
    private readonly workspace: WorkspaceCredentialStore,
    private readonly getConfig: () => DiagnosticsConfig,
  ) {}

  dispose(): void {
    this.channel?.dispose();
  }

  async run(): Promise<void> {
    const { origin, lang } = this.getConfig();
    const out = (this.channel ??= vscode.window.createOutputChannel("OpenCode Go Usage"));
    out.clear();
    out.show(true);

    const line = (text = "") => out.appendLine(text);

    line(`OpenCode Go Usage — diagnostics  (${new Date().toISOString()})`);
    line(`origin: ${origin}`);
    line();

    const credentials = await this.workspace.get();
    if (!credentials) {
      const id = WorkspaceCredentialStore.readWorkspaceId();
      const hasCookie = await this.workspace.hasCookie();
      line("Not connected.");
      line(`  workspaceId: ${id || "(empty)"}`);
      line(`  auth cookie: ${hasCookie ? "stored" : "missing"}`);
      line();
      line("Run “OpenCode Go: Connect workspace” to set both.");
      return;
    }

    line(`workspaceId: ${credentials.workspaceId}`);
    line(`auth cookie: [${credentials.authCookie.length} chars]`);
    line(`URL: ${workspaceUrl(credentials.workspaceId, origin)}`);
    line();

    try {
      const meters = await fetchWorkspaceUsage(credentials, origin);
      line(`parsed ${meters.length} window(s):`);
      for (const meter of orderedMeters(meters)) {
        line(
          `  ${meterLabel(meter.kind, lang)}: ${usedPercent(meter)}%` +
            `  status=${meter.status}` +
            `  resets ${meter.resetsAt ?? "(window not open)"}` +
            (formatCountdown(meter.resetsAt, lang)
              ? `  (${formatCountdown(meter.resetsAt, lang)})`
              : ""),
        );
      }
      line();
      line("Compare these with the workspace page in your browser.");
      line("If they differ, the page was probably served from a different session.");
    } catch (err) {
      line(`failed: ${describeError(err, lang)}`);
      line();
      line("A dead session is the usual cause — reconnect with a fresh auth cookie.");
    }
  }
}
