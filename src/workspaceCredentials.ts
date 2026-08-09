import * as vscode from "vscode";

import { WorkspaceCredentials } from "./workspace";

/**
 * Credentials for the workspace console.
 *
 * The workspace id is ordinary configuration and lives in settings; the session
 * cookie is a live credential and lives in SecretStorage, never in a settings
 * file where it would land in a synced profile or a screenshot.
 */

const SECTION = "opencodeGo";
const WORKSPACE_ID_KEY = "workspaceId";
const COOKIE_SECRET = "opencodeGo.workspaceCookie";

export class WorkspaceCredentialStore {
  private cached: string | undefined | null = null;

  constructor(private readonly secrets: vscode.SecretStorage) {}

  static readWorkspaceId(): string {
    return (vscode.workspace.getConfiguration(SECTION).get<string>(WORKSPACE_ID_KEY) ?? "").trim();
  }

  /** Both halves, or undefined when either is missing. */
  async get(): Promise<WorkspaceCredentials | undefined> {
    const workspaceId = WorkspaceCredentialStore.readWorkspaceId();
    if (!workspaceId) {
      return undefined;
    }
    const authCookie = await this.getCookie();
    if (!authCookie) {
      return undefined;
    }
    return { workspaceId, authCookie };
  }

  async getCookie(): Promise<string | undefined> {
    if (this.cached === null) {
      this.cached = await this.secrets.get(COOKIE_SECRET);
    }
    return this.cached ?? undefined;
  }

  async hasCookie(): Promise<boolean> {
    return (await this.getCookie()) !== undefined;
  }

  async setCookie(value: string): Promise<void> {
    const trimmed = value.trim();
    this.cached = trimmed;
    await this.secrets.store(COOKIE_SECRET, trimmed);
  }

  async setWorkspaceId(id: string): Promise<void> {
    await vscode.workspace
      .getConfiguration(SECTION)
      .update(WORKSPACE_ID_KEY, id.trim(), vscode.ConfigurationTarget.Global);
  }

  async clear(): Promise<void> {
    this.cached = undefined;
    await this.secrets.delete(COOKIE_SECRET);
    await this.setWorkspaceId("");
  }

  /** Drops the in-memory copy so the next read goes back to SecretStorage. */
  invalidate(): void {
    this.cached = null;
  }
}
