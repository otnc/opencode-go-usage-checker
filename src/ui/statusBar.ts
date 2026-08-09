import * as vscode from "vscode";

import { formatCountdown, meterLabel, meterShortLabel } from "../format";
import { Lang, strings } from "../i18n";
import {
  MeterKind,
  mostConstrained,
  orderedMeters,
  severityOf,
  UsageMeter,
  usedPercent,
} from "../meters";
import { UsageState } from "../usageStore";

export interface StatusBarConfig {
  enabled: boolean;
  meter: "auto" | MeterKind;
  lang: Lang;
  consoleUrl: string;
}

export class UsageStatusBar implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;

  constructor(private readonly getConfig: () => StatusBarConfig) {
    this.item = vscode.window.createStatusBarItem(
      "opencodeGo.usage",
      vscode.StatusBarAlignment.Right,
      100,
    );
    this.item.name = "Go Usage";
    this.item.command = "opencodeGo.showUsage";
  }

  dispose(): void {
    this.item.dispose();
  }

  render(state: UsageState): void {
    const config = this.getConfig();
    if (!config.enabled) {
      this.item.hide();
      return;
    }

    this.item.backgroundColor = undefined;

    const s = strings(config.lang);

    switch (state.kind) {
      case "loading":
        if (!state.last) {
          this.item.text = "$(sync~spin) Go Usage";
          this.item.tooltip = s.loading;
          break;
        }
        // A refresh over known-good data shouldn't make the bar flicker.
        this.renderReady(state.last.meters, config);
        break;

      case "needsSetup":
        // Clicking opens the panel, which is where the setup steps live —
        // launching the connect flow straight from here would skip the
        // explanation of what the two prompts are going to ask for.
        this.item.text = "$(plug) Go Usage";
        this.item.tooltip = s.wsNoCredentials;
        break;

      case "error":
        this.item.text = "$(warning) Go Usage";
        this.item.tooltip = new vscode.MarkdownString(
          `**${s.fetchFailed}**\n\n${escapeMarkdown(state.message)}`,
        );
        this.item.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
        break;

      case "ready":
        this.renderReady(state.snapshot.meters, config);
        break;
    }

    this.item.command = "opencodeGo.showUsage";
    this.item.show();
  }

  private renderReady(meters: UsageMeter[], config: StatusBarConfig): void {
    const primary =
      config.meter === "auto"
        ? mostConstrained(meters)
        : (meters.find((m) => m.kind === config.meter) ?? mostConstrained(meters));

    if (!primary) {
      this.item.text = "$(pulse) Go Usage —";
      this.item.tooltip = strings(config.lang).wsNoPayload;
      return;
    }

    const percent = usedPercent(primary);
    const short = config.meter === "auto" ? meterShortLabel(primary.kind, config.lang) : "";
    this.item.text = short
      ? `$(pulse) Go Usage ${short} ${percent}%`
      : `$(pulse) Go Usage ${percent}%`;

    const severity = severityOf(primary);
    if (severity === "critical") {
      this.item.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
    } else if (severity === "warn") {
      this.item.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
    }

    this.item.tooltip = this.buildTooltip(meters, config);
  }

  private buildTooltip(meters: UsageMeter[], config: StatusBarConfig): vscode.MarkdownString {
    const s = strings(config.lang);
    const md = new vscode.MarkdownString(undefined, true);
    md.isTrusted = true;
    md.supportThemeIcons = true;
    md.appendMarkdown(`**${s.title}**\n\n`);

    for (const meter of orderedMeters(meters)) {
      const percent = usedPercent(meter);
      const countdown = formatCountdown(meter.resetsAt, config.lang);
      md.appendMarkdown(
        `${bar(percent)} **${percent}%** — ${escapeMarkdown(meterLabel(meter.kind, config.lang))}\n\n` +
          (countdown ? `&nbsp;&nbsp;${escapeMarkdown(countdown)}\n\n` : ""),
      );
    }

    md.appendMarkdown(`\n[${s.openConsole}](${config.consoleUrl})`);
    return md;
  }
}

/** Twelve-cell text bar — MarkdownString tooltips can't render real progress bars. */
function bar(percent: number): string {
  const cells = 12;
  const filled = Math.min(cells, Math.max(0, Math.round((percent / 100) * cells)));
  return `\`${"█".repeat(filled)}${"░".repeat(cells - filled)}\``;
}

function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_{}[\]()#+\-.!|>])/g, "\\$1");
}
