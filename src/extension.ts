/*---------------------------------------------------------
 * Copyright (c) 2026 René Nicolaus.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------*/

import * as vscode from "vscode";
import { defaultRules } from "./default-rules";
import { havTaskListDecorations } from "./decorations";
import { havTaskListDiagnostics } from "./diagnostics";
import {
  formatAppErrorMessage,
  formatScanSummary,
  formatStatusBarTasks,
  formatStatusBarTooltip,
  formatTreeFilterActive,
  formatTreeFilterNoMatches,
  uiStrings
} from "./strings/ui";
import { havTaskListTreeDataProvider, havTaskListTreeNode } from "./task-tree";
import {
  havTaskListConfig,
  havTaskListGroupBy,
  havTaskListRule,
  havTaskListTask
} from "./types";
import { scanWorkspaceTasks } from "./workspace-scanner";

let lastTasks: havTaskListTask[] = [];
let debounceTimer: NodeJS.Timeout | undefined;
let activeScanToken: object | undefined;

const defaultIncludeGlobs = ["**/*"];
const defaultExcludeGlobs = [
  "**/.git/**",
  "**/.hg/**",
  "**/.svn/**",
  "**/node_modules/**",
  "**/bower_components/**",
  "**/dist/**",
  "**/out/**",
  "**/build/**",
  "**/coverage/**",
  "**/.next/**",
  "**/.nuxt/**",
  "**/.turbo/**"
];

function readStringArray(
  config: vscode.WorkspaceConfiguration,
  key: string,
  fallback: string[]
): string[] {
  const value = config.get<string[]>(key, fallback);

  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : fallback;
}

function readGroupBy(
  config: vscode.WorkspaceConfiguration
): havTaskListGroupBy {
  const groupBy = config.get<havTaskListGroupBy>("groupBy", "file");

  return groupBy === "tag" || groupBy === "flat" ? groupBy : "file";
}

function readConfig(): havTaskListConfig {
  const config = vscode.workspace.getConfiguration("havTaskList");

  return {
    rules: config.get<havTaskListRule[]>("rules", defaultRules),
    includeGlobs: readStringArray(config, "includeGlobs", defaultIncludeGlobs),
    excludeGlobs: readStringArray(config, "excludeGlobs", defaultExcludeGlobs),
    maxFileSizeKb: config.get<number>("maxFileSizeKb", 512),
    showDiagnostics: config.get<boolean>("showDiagnostics", true),
    showEditorHighlights: config.get<boolean>("showEditorHighlights", true),
    groupBy: readGroupBy(config)
  };
}

function readAutoScan(): boolean {
  return vscode.workspace
    .getConfiguration("havTaskList")
    .get<boolean>("autoScan", true);
}

function readDebounceMs(): number {
  return vscode.workspace
    .getConfiguration("havTaskList")
    .get<number>("debounceMs", 250);
}

function hasWorkspaceFolder(): boolean {
  return Boolean(vscode.workspace.workspaceFolders?.length);
}

function updateStatusBar(
  statusBar: vscode.StatusBarItem,
  tasks: havTaskListTask[]
): void {
  statusBar.text =
    tasks.length > 0
      ? formatStatusBarTasks(tasks.length)
      : uiStrings.statusReady;

  statusBar.tooltip = formatStatusBarTooltip(tasks.length);

  statusBar.show();
}

function updateTreeContext(
  groupBy: havTaskListGroupBy,
  filterText: string
): void {
  void vscode.commands.executeCommand(
    "setContext",
    "havTaskList.groupBy",
    groupBy
  );

  void vscode.commands.executeCommand(
    "setContext",
    "havTaskList.hasFilter",
    filterText.length > 0
  );
}

function updateTreeMessage(
  treeProvider: havTaskListTreeDataProvider,
  treeView: vscode.TreeView<havTaskListTreeNode>
): void {
  const filterText = treeProvider.getFilter();

  if (filterText) {
    const visibleTasks = treeProvider.getVisibleTaskCount();

    treeView.message =
      visibleTasks === 0
        ? formatTreeFilterNoMatches(filterText)
        : formatTreeFilterActive(filterText, visibleTasks);

    return;
  }

  treeView.message =
    lastTasks.length === 0 ? uiStrings.noTasksFound : undefined;
}

async function openTask(task: havTaskListTask): Promise<void> {
  const document = await vscode.workspace.openTextDocument(
    vscode.Uri.file(task.file)
  );

  await vscode.window.showTextDocument(document, {
    selection: new vscode.Range(
      task.line,
      task.column,
      task.line,
      task.column + Math.max(task.match.length, 1)
    )
  });
}

async function scanAndUpdate(
  diagnostics: havTaskListDiagnostics,
  decorations: havTaskListDecorations,
  treeProvider: havTaskListTreeDataProvider,
  treeView: vscode.TreeView<havTaskListTreeNode>,
  statusBar: vscode.StatusBarItem,
  showMessage: boolean
): Promise<void> {
  const config = readConfig();

  if (!hasWorkspaceFolder()) {
    lastTasks = [];

    diagnostics.update([]);
    decorations.update([], config.showEditorHighlights);

    treeProvider.refresh([], config.groupBy);

    updateTreeMessage(treeProvider, treeView);
    updateTreeContext(config.groupBy, treeProvider.getFilter());
    updateStatusBar(statusBar, lastTasks);

    if (showMessage) {
      vscode.window.showWarningMessage(uiStrings.openWorkspaceFolderFirst);
    }

    return;
  }

  const scanToken = {};
  activeScanToken = scanToken;

  try {
    const tasks = showMessage
      ? await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: uiStrings.scanStarted,
            cancellable: false
          },
          () => scanWorkspaceTasks(config)
        )
      : await scanWorkspaceTasks(config);

    if (scanToken !== activeScanToken) {
      return;
    }

    lastTasks = tasks;

    diagnostics.update(config.showDiagnostics ? lastTasks : []);
    decorations.update(lastTasks, config.showEditorHighlights);

    treeProvider.refresh(lastTasks, config.groupBy);

    updateTreeMessage(treeProvider, treeView);
    updateTreeContext(config.groupBy, treeProvider.getFilter());
    updateStatusBar(statusBar, lastTasks);

    if (showMessage) {
      vscode.window.showInformationMessage(formatScanSummary(lastTasks.length));
    }
  } catch (err) {
    if (showMessage) {
      vscode.window.showErrorMessage(formatAppErrorMessage(err));
    }
  }
}

function scheduleScan(
  diagnostics: havTaskListDiagnostics,
  decorations: havTaskListDecorations,
  treeProvider: havTaskListTreeDataProvider,
  treeView: vscode.TreeView<havTaskListTreeNode>,
  statusBar: vscode.StatusBarItem
): void {
  if (!readAutoScan()) {
    return;
  }

  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(
    () =>
      void scanAndUpdate(
        diagnostics,
        decorations,
        treeProvider,
        treeView,
        statusBar,
        false
      ),
    readDebounceMs()
  );
}

function taskQuickPickIcon(task: havTaskListTask): string {
  if (task.severity === "error") {
    return "$(error)";
  }

  if (task.severity === "warning") {
    return "$(warning)";
  }

  return "$(info)";
}

async function goToTask(): Promise<void> {
  if (lastTasks.length === 0) {
    vscode.window.showInformationMessage(uiStrings.noTasksFound);

    return;
  }

  const picked = await vscode.window.showQuickPick(
    lastTasks.map((task) => ({
      label: `${taskQuickPickIcon(task)} ${task.label}: ${task.text || task.match}`,
      description: `${task.relativeFile}:${task.line + 1}`,
      detail: task.severity,
      task
    })),
    { placeHolder: uiStrings.taskQuickPickPlaceholder }
  );

  if (!picked) {
    return;
  }

  await openTask(picked.task);
}

async function setGroupBy(
  groupBy: havTaskListGroupBy,
  treeProvider: havTaskListTreeDataProvider,
  treeView: vscode.TreeView<havTaskListTreeNode>
): Promise<void> {
  await vscode.workspace
    .getConfiguration("havTaskList")
    .update("groupBy", groupBy, vscode.ConfigurationTarget.Workspace);

  treeProvider.refresh(lastTasks, groupBy);

  updateTreeMessage(treeProvider, treeView);
  updateTreeContext(groupBy, treeProvider.getFilter());
}

async function filterTree(
  treeProvider: havTaskListTreeDataProvider,
  treeView: vscode.TreeView<havTaskListTreeNode>
): Promise<void> {
  const filterText = await vscode.window.showInputBox({
    prompt: uiStrings.treeFilterPrompt,
    placeHolder: uiStrings.treeFilterPlaceholder,
    value: treeProvider.getFilter()
  });

  if (filterText === undefined) {
    return;
  }

  treeProvider.setFilter(filterText);

  updateTreeMessage(treeProvider, treeView);
  updateTreeContext(
    readGroupBy(vscode.workspace.getConfiguration("havTaskList")),
    treeProvider.getFilter()
  );
}

function clearTreeFilter(
  treeProvider: havTaskListTreeDataProvider,
  treeView: vscode.TreeView<havTaskListTreeNode>
): void {
  treeProvider.clearFilter();

  updateTreeMessage(treeProvider, treeView);
  updateTreeContext(
    readGroupBy(vscode.workspace.getConfiguration("havTaskList")),
    ""
  );
}

async function expandTree(
  treeProvider: havTaskListTreeDataProvider,
  treeView: vscode.TreeView<havTaskListTreeNode>
): Promise<void> {
  for (const node of treeProvider.getExpandableNodes()) {
    await treeView.reveal(node, {
      expand: true,
      focus: false,
      select: false
    });
  }
}

async function collapseTree(): Promise<void> {
  await vscode.commands.executeCommand(
    "workbench.actions.treeView.havTaskList.tasks.collapseAll"
  );
}

export function activate(context: vscode.ExtensionContext): void {
  const diagnostics = new havTaskListDiagnostics();
  const decorations = new havTaskListDecorations();
  const treeProvider = new havTaskListTreeDataProvider();
  const treeView = vscode.window.createTreeView("havTaskList.tasks", {
    treeDataProvider: treeProvider,
    showCollapseAll: false
  });
  const statusBar = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );

  statusBar.command = "havTaskList.goToTask";

  updateTreeContext(
    readGroupBy(vscode.workspace.getConfiguration("havTaskList")),
    ""
  );

  context.subscriptions.push(
    diagnostics,
    decorations,
    treeProvider,
    treeView,
    statusBar
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("havTaskList.refresh", () =>
      scanAndUpdate(
        diagnostics,
        decorations,
        treeProvider,
        treeView,
        statusBar,
        true
      )
    ),
    vscode.commands.registerCommand("havTaskList.goToTask", goToTask),
    vscode.commands.registerCommand("havTaskList.groupByFile", () =>
      setGroupBy("file", treeProvider, treeView)
    ),
    vscode.commands.registerCommand("havTaskList.groupByTag", () =>
      setGroupBy("tag", treeProvider, treeView)
    ),
    vscode.commands.registerCommand("havTaskList.showFlatView", () =>
      setGroupBy("flat", treeProvider, treeView)
    ),
    vscode.commands.registerCommand("havTaskList.filterTree", () =>
      filterTree(treeProvider, treeView)
    ),
    vscode.commands.registerCommand("havTaskList.clearTreeFilter", () =>
      clearTreeFilter(treeProvider, treeView)
    ),
    vscode.commands.registerCommand("havTaskList.expandTree", () =>
      expandTree(treeProvider, treeView)
    ),
    vscode.commands.registerCommand("havTaskList.collapseTree", collapseTree),
    vscode.commands.registerCommand("havTaskList.openTask", (task) =>
      openTask(task as havTaskListTask)
    )
  );

  const watcher = vscode.workspace.createFileSystemWatcher("**/*");

  context.subscriptions.push(
    watcher,
    watcher.onDidChange(() =>
      scheduleScan(diagnostics, decorations, treeProvider, treeView, statusBar)
    ),
    watcher.onDidCreate(() =>
      scheduleScan(diagnostics, decorations, treeProvider, treeView, statusBar)
    ),
    watcher.onDidDelete(() =>
      scheduleScan(diagnostics, decorations, treeProvider, treeView, statusBar)
    ),
    vscode.workspace.onDidSaveTextDocument(() =>
      scheduleScan(diagnostics, decorations, treeProvider, treeView, statusBar)
    ),
    vscode.workspace.onDidChangeWorkspaceFolders(() =>
      scheduleScan(diagnostics, decorations, treeProvider, treeView, statusBar)
    ),
    vscode.window.onDidChangeVisibleTextEditors(() =>
      decorations.refreshVisibleEditors()
    ),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("havTaskList.groupBy")) {
        const config = readConfig();

        treeProvider.refresh(lastTasks, config.groupBy);

        updateTreeMessage(treeProvider, treeView);
        updateTreeContext(config.groupBy, treeProvider.getFilter());
      }

      if (event.affectsConfiguration("havTaskList.showDiagnostics")) {
        const config = readConfig();

        diagnostics.update(config.showDiagnostics ? lastTasks : []);
      }

      if (event.affectsConfiguration("havTaskList.showEditorHighlights")) {
        const config = readConfig();

        decorations.update(lastTasks, config.showEditorHighlights);
      }

      if (event.affectsConfiguration("havTaskList")) {
        scheduleScan(
          diagnostics,
          decorations,
          treeProvider,
          treeView,
          statusBar
        );
      }
    })
  );

  void scanAndUpdate(
    diagnostics,
    decorations,
    treeProvider,
    treeView,
    statusBar,
    false
  );
}

export function deactivate(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
}
