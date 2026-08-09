import * as vscode from "vscode";

import { Lang, strings } from "../i18n";
import { WorkspaceCredentialStore } from "../workspaceCredentials";

export interface WorkspaceCommandsConfig {
  lang: Lang;
}

const WORKSPACE_ID_PATTERN = /^wrk_[0-9A-Za-z]{8,}$/;

/**
 * Collects the two things the workspace console needs: the id from the URL and
 * the browser's `auth` cookie. The cookie prompt is masked and the value goes
 * straight to SecretStorage — it is a live session, not a setting.
 */
export class WorkspaceCommands {
  constructor(
    private readonly credentials: WorkspaceCredentialStore,
    private readonly getConfig: () => WorkspaceCommandsConfig,
  ) {}

  /** Returns true when both halves were captured. */
  async connect(): Promise<boolean> {
    const s = strings(this.getConfig().lang);

    const workspaceId = (
      await vscode.window.showInputBox({
        title: s.wsConfigureTitle,
        prompt: s.wsWorkspaceIdPrompt,
        placeHolder: s.wsWorkspaceIdPlaceholder,
        value: WorkspaceCredentialStore.readWorkspaceId(),
        ignoreFocusOut: true,
        validateInput: (value) =>
          WORKSPACE_ID_PATTERN.test(value.trim()) ? undefined : s.wsWorkspaceIdInvalid,
      })
    )?.trim();
    if (!workspaceId) {
      return false;
    }

    const cookie = (
      await vscode.window.showInputBox({
        title: s.wsConfigureTitle,
        prompt: `${s.wsCookiePrompt} — ${s.wsHowTo}`,
        placeHolder: s.wsCookiePlaceholder,
        password: true,
        ignoreFocusOut: true,
        validateInput: (value) => (value.trim() === "" ? s.wsCookieRequired : undefined),
      })
    )?.trim();
    if (!cookie) {
      return false;
    }

    await this.credentials.setWorkspaceId(workspaceId);
    await this.credentials.setCookie(cookie);
    void vscode.window.showInformationMessage(s.wsConfigured(workspaceId));
    return true;
  }

  async disconnect(): Promise<void> {
    const s = strings(this.getConfig().lang);
    await this.credentials.clear();
    void vscode.window.showInformationMessage(s.wsCleared);
  }
}
