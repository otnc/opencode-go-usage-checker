import * as vscode from "vscode";

import { Lang, toLang } from "./i18n";
import { MeterKind } from "./meters";
import { UsageStore } from "./usageStore";
import { workspaceUrl } from "./workspace";
import { WorkspaceCredentialStore } from "./workspaceCredentials";
import { Diagnostics } from "./ui/diagnostics";
import { UsageStatusBar } from "./ui/statusBar";
import { UsageViewProvider } from "./ui/usageView";
import { WorkspaceCommands } from "./ui/workspaceCommands";

const SECTION = "opencodeGo";
const DEFAULT_ORIGIN = "https://opencode.ai";

interface Settings {
  origin: string;
  refreshIntervalSeconds: number;
  workspaceId: string;
  statusBarEnabled: boolean;
  statusBarMeter: "auto" | MeterKind;
  lang: Lang;
}

function readSettings(): Settings {
  const config = vscode.workspace.getConfiguration(SECTION);
  const origin = (config.get<string>("baseUrl") ?? DEFAULT_ORIGIN).trim() || DEFAULT_ORIGIN;
  return {
    origin: origin.replace(/\/+$/, ""),
    refreshIntervalSeconds: config.get<number>("refreshInterval") ?? 300,
    workspaceId: (config.get<string>("workspaceId") ?? "").trim(),
    statusBarEnabled: config.get<boolean>("statusBar.enabled") ?? true,
    statusBarMeter:
      (config.get<string>("statusBar.meter") as Settings["statusBarMeter"]) ?? "five_hour",
    // `auto` follows VS Code's own display language.
    lang: toLang(config.get<string>("language"), vscode.env.language),
  };
}

export function activate(context: vscode.ExtensionContext): void {
  let settings = readSettings();
  const currentSettings = () => settings;

  /** The workspace page itself when one is configured, the site otherwise. */
  const consoleUrl = (): string => {
    const { workspaceId, origin } = currentSettings();
    return workspaceId ? workspaceUrl(workspaceId, origin) : origin;
  };

  const credentials = new WorkspaceCredentialStore(context.secrets);

  const store = new UsageStore(credentials, () => ({
    origin: currentSettings().origin,
    refreshIntervalSeconds: currentSettings().refreshIntervalSeconds,
    lang: currentSettings().lang,
  }));

  const statusBar = new UsageStatusBar(() => ({
    enabled: currentSettings().statusBarEnabled,
    meter: currentSettings().statusBarMeter,
    lang: currentSettings().lang,
    consoleUrl: consoleUrl(),
  }));

  const view = new UsageViewProvider(context.extensionUri, () => ({
    lang: currentSettings().lang,
    consoleUrl: consoleUrl(),
  }));

  const diagnostics = new Diagnostics(credentials, () => ({
    origin: currentSettings().origin,
    lang: currentSettings().lang,
  }));

  const workspaceCommands = new WorkspaceCommands(credentials, () => ({
    lang: currentSettings().lang,
  }));

  context.subscriptions.push(
    store,
    statusBar,
    view,
    diagnostics,
    vscode.window.registerWebviewViewProvider(UsageViewProvider.viewType, view, {
      webviewOptions: { retainContextWhenHidden: false },
    }),
    store.onDidChange((state) => {
      statusBar.render(state);
      view.render(state);
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (!event.affectsConfiguration(SECTION)) {
        return;
      }
      const previous = settings;
      settings = readSettings();
      statusBar.render(store.state);
      view.render(store.state);
      store.reconfigure();
      if (previous.origin !== settings.origin || previous.workspaceId !== settings.workspaceId) {
        void store.refresh();
      }
    }),
    vscode.commands.registerCommand("opencodeGo.showUsage", async () => {
      await vscode.commands.executeCommand(`${UsageViewProvider.viewType}.focus`);
    }),
    vscode.commands.registerCommand("opencodeGo.refresh", async () => {
      await store.refresh();
    }),
    vscode.commands.registerCommand("opencodeGo.openConsole", async () => {
      await vscode.env.openExternal(vscode.Uri.parse(consoleUrl()));
    }),
    vscode.commands.registerCommand("opencodeGo.connectWorkspace", async () => {
      if (await workspaceCommands.connect()) {
        await store.refresh();
      }
    }),
    vscode.commands.registerCommand("opencodeGo.disconnectWorkspace", async () => {
      await workspaceCommands.disconnect();
      await store.refresh();
    }),
    vscode.commands.registerCommand("opencodeGo.diagnostics", async () => {
      await diagnostics.run();
    }),
  );

  statusBar.render(store.state);
  store.start();
}

export function deactivate(): void {
  // Everything is registered in context.subscriptions and disposed by VS Code.
}
