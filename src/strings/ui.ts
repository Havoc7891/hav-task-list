/*---------------------------------------------------------
 * Copyright (c) 2026 René Nicolaus.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------*/

import * as vscode from "vscode";

export const appName = "hav Task List";

interface HavTaskListUiStrings {
  openWorkspaceFolderFirst: string;
  noTasksFound: string;
  taskQuickPickPlaceholder: string;
  treeFilterPrompt: string;
  treeFilterPlaceholder: string;
  statusReady: string;
  scanStarted: string;
}

export const uiStrings: HavTaskListUiStrings = {
  get openWorkspaceFolderFirst(): string {
    return vscode.l10n.t("{0}: Open a workspace folder first.", appName);
  },
  get noTasksFound(): string {
    return vscode.l10n.t("{0}: No tasks found.", appName);
  },
  get taskQuickPickPlaceholder(): string {
    return vscode.l10n.t("Select a task to open its location");
  },
  get treeFilterPrompt(): string {
    return vscode.l10n.t("Filter tasks");
  },
  get treeFilterPlaceholder(): string {
    return vscode.l10n.t("Text, tag, severity, or file path");
  },
  get statusReady(): string {
    return `$(check) ${appName}`;
  },
  get scanStarted(): string {
    return vscode.l10n.t("{0}: Scanning workspace tasks...", appName);
  }
};

function formatTaskCount(tasks: number): string {
  if (tasks === 1) {
    return vscode.l10n.t("1 task");
  }

  return vscode.l10n.t("{0} tasks", tasks);
}

export function formatStatusBarTasks(tasks: number): string {
  return `$(checklist) ${formatTaskCount(tasks)}`;
}

export function formatStatusBarTooltip(tasks: number): string {
  return vscode.l10n.t("{0} in workspace", formatTaskCount(tasks));
}

export function formatScanSummary(tasks: number): string {
  if (tasks === 0) {
    return uiStrings.noTasksFound;
  }

  return vscode.l10n.t("{0}: Found {1}", appName, formatTaskCount(tasks));
}

export function formatTreeFilterActive(
  filterText: string,
  tasks: number
): string {
  return vscode.l10n.t("Filter: {0} ({1})", filterText, formatTaskCount(tasks));
}

export function formatTreeFilterNoMatches(filterText: string): string {
  return vscode.l10n.t("No tasks match filter: {0}", filterText);
}

export function formatAppErrorMessage(error: unknown): string {
  const errorMessage = error instanceof Error ? error.message : String(error);

  return vscode.l10n.t("{0}: {1}", appName, errorMessage);
}
