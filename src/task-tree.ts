/*---------------------------------------------------------
 * Copyright (c) 2026 René Nicolaus.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------*/

import * as path from "path";
import * as vscode from "vscode";
import { havTaskListGroupBy, havTaskListTask } from "./types";

interface havTaskListFolderNode {
  type: "folder";
  id: string;
  label: string;
  path: string;
  tasks: havTaskListTask[];
  children: havTaskListTreeNode[];
  parent?: havTaskListTreeNode;
}

interface havTaskListFileNode {
  type: "file";
  id: string;
  label: string;
  file: string;
  relativeFile: string;
  tasks: havTaskListTask[];
  parent?: havTaskListTreeNode;
}

interface havTaskListTagNode {
  type: "tag";
  id: string;
  label: string;
  tasks: havTaskListTask[];
  parent?: havTaskListTreeNode;
}

interface havTaskListTaskNode {
  type: "task";
  task: havTaskListTask;
  parent?: havTaskListTreeNode;
}

interface havTaskListMutableFolder {
  id: string;
  label: string;
  path: string;
  tasks: havTaskListTask[];
  folders: Map<string, havTaskListMutableFolder>;
  files: Map<string, havTaskListFileNode>;
}

export type havTaskListTreeNode =
  | havTaskListFolderNode
  | havTaskListFileNode
  | havTaskListTagNode
  | havTaskListTaskNode;

function severityIcon(task: havTaskListTask): vscode.ThemeIcon {
  const color = task.color ? new vscode.ThemeColor(task.color) : undefined;

  if (task.severity === "error") {
    return new vscode.ThemeIcon("error", color);
  }

  if (task.severity === "warning") {
    return new vscode.ThemeIcon("warning", color);
  }

  return new vscode.ThemeIcon("info", color);
}

function tagIcon(tag: havTaskListTagNode): vscode.ThemeIcon {
  const color = tag.tasks[0]?.color
    ? new vscode.ThemeColor(tag.tasks[0].color)
    : undefined;

  return new vscode.ThemeIcon("tag", color);
}

function taskSummary(task: havTaskListTask): string {
  return task.text || task.match;
}

function matchesTaskFilter(task: havTaskListTask, filterText: string): boolean {
  const normalizedFilter = filterText.trim().toLowerCase();
  if (!normalizedFilter) {
    return true;
  }

  return [
    task.label,
    task.ruleId,
    task.severity,
    task.relativeFile,
    task.match,
    task.text
  ].some((value) => value.toLowerCase().includes(normalizedFilter));
}

function compareByLabel(
  left: { label: string },
  right: { label: string }
): number {
  return left.label.localeCompare(right.label);
}

function createMutableFolder(
  id: string,
  label: string,
  folderPath: string
): havTaskListMutableFolder {
  return {
    id,
    label,
    path: folderPath,
    tasks: [],
    folders: new Map<string, havTaskListMutableFolder>(),
    files: new Map<string, havTaskListFileNode>()
  };
}

function getOrCreateFolder(
  parent: havTaskListMutableFolder,
  label: string
): havTaskListMutableFolder {
  const folderPath = parent.path ? `${parent.path}/${label}` : label;

  const existingFolder = parent.folders.get(folderPath);
  if (existingFolder) {
    return existingFolder;
  }

  const folder = createMutableFolder(folderPath, label, folderPath);
  parent.folders.set(folderPath, folder);

  return folder;
}

function toFileNode(
  file: havTaskListFileNode,
  parent: havTaskListTreeNode
): havTaskListFileNode {
  return {
    ...file,
    parent
  };
}

function toFolderNode(
  folder: havTaskListMutableFolder,
  parent?: havTaskListTreeNode
): havTaskListFolderNode {
  const node: havTaskListFolderNode = {
    type: "folder",
    id: folder.id,
    label: folder.label,
    path: folder.path,
    tasks: folder.tasks,
    children: [],
    parent
  };

  const folders = [...folder.folders.values()]
    .map((childFolder) => toFolderNode(childFolder, node))
    .sort(compareByLabel);

  const files = [...folder.files.values()]
    .sort(compareByLabel)
    .map((file) => toFileNode(file, node));

  node.children = [...folders, ...files];

  return node;
}

export class havTaskListTreeDataProvider implements vscode.TreeDataProvider<havTaskListTreeNode> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<
    havTaskListTreeNode | undefined
  >();

  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;

  private tasks: havTaskListTask[] = [];
  private groupBy: havTaskListGroupBy = "file";
  private filterText = "";

  refresh(tasks: havTaskListTask[], groupBy: havTaskListGroupBy): void {
    this.tasks = tasks;
    this.groupBy = groupBy;

    this.onDidChangeTreeDataEmitter.fire(undefined);
  }

  setFilter(filterText: string): void {
    this.filterText = filterText.trim();

    this.onDidChangeTreeDataEmitter.fire(undefined);
  }

  clearFilter(): void {
    this.setFilter("");
  }

  getFilter(): string {
    return this.filterText;
  }

  getVisibleTaskCount(): number {
    return this.getVisibleTasks().length;
  }

  getExpandableNodes(): havTaskListTreeNode[] {
    const expandableNodes: havTaskListTreeNode[] = [];

    this.collectExpandableNodes(this.createRootNodes(), expandableNodes);

    return expandableNodes;
  }

  dispose(): void {
    this.onDidChangeTreeDataEmitter.dispose();
  }

  getTreeItem(element: havTaskListTreeNode): vscode.TreeItem {
    if (element.type === "folder") {
      const treeItem = new vscode.TreeItem(
        element.label,
        vscode.TreeItemCollapsibleState.Expanded
      );

      treeItem.description = `${element.tasks.length}`;
      treeItem.tooltip = element.path;
      treeItem.contextValue = "havTaskList.folder";
      treeItem.id = `folder:${element.id}`;
      treeItem.iconPath = new vscode.ThemeIcon("folder");

      return treeItem;
    }

    if (element.type === "file") {
      const treeItem = new vscode.TreeItem(
        element.label,
        vscode.TreeItemCollapsibleState.Expanded
      );

      treeItem.description = `${element.tasks.length}`;
      treeItem.tooltip = element.relativeFile;
      treeItem.contextValue = "havTaskList.file";
      treeItem.id = `file:${element.id}`;
      treeItem.iconPath = new vscode.ThemeIcon("file-code");
      treeItem.resourceUri = vscode.Uri.file(element.file);

      return treeItem;
    }

    if (element.type === "tag") {
      const treeItem = new vscode.TreeItem(
        element.label,
        vscode.TreeItemCollapsibleState.Expanded
      );

      treeItem.description = `${element.tasks.length}`;
      treeItem.contextValue = "havTaskList.tag";
      treeItem.id = `tag:${element.id}`;
      treeItem.iconPath = tagIcon(element);

      return treeItem;
    }

    const task = element.task;

    const treeItem = new vscode.TreeItem(
      taskSummary(task),
      vscode.TreeItemCollapsibleState.None
    );

    treeItem.description =
      this.groupBy === "file"
        ? `${task.label}:${task.line + 1}`
        : `${task.relativeFile}:${task.line + 1}`;
    treeItem.tooltip = `${task.relativeFile}:${task.line + 1}:${task.column + 1} ${task.label}: ${taskSummary(task)}`;
    treeItem.contextValue = "havTaskList.task";
    treeItem.id = `task:${task.relativeFile}:${task.line}:${task.column}:${task.ruleId}`;
    treeItem.iconPath = severityIcon(task);
    treeItem.command = {
      command: "havTaskList.openTask",
      title: "Open Task",
      arguments: [task]
    };

    return treeItem;
  }

  getChildren(
    element?: havTaskListTreeNode
  ): vscode.ProviderResult<havTaskListTreeNode[]> {
    return element ? this.getChildNodes(element) : this.createRootNodes();
  }

  getParent(
    element: havTaskListTreeNode
  ): vscode.ProviderResult<havTaskListTreeNode> {
    return element.parent;
  }

  private createFileTree(): havTaskListTreeNode[] {
    const root = createMutableFolder("", "", "");

    for (const task of this.getVisibleTasks()) {
      const fileParts = task.relativeFile.split("/").filter(Boolean);
      const fileName = fileParts.pop() ?? path.basename(task.file);

      let folder = root;

      for (const folderName of fileParts) {
        folder = getOrCreateFolder(folder, folderName);
        folder.tasks.push(task);
      }

      const fileId = task.relativeFile;
      const existingFile = folder.files.get(fileId);
      if (existingFile) {
        existingFile.tasks.push(task);
      } else {
        folder.files.set(fileId, {
          type: "file",
          id: fileId,
          label: fileName,
          file: task.file,
          relativeFile: task.relativeFile,
          tasks: [task]
        });
      }
    }

    const folders = [...root.folders.values()]
      .map((folder) => toFolderNode(folder))
      .sort(compareByLabel);
    const files = [...root.files.values()].sort(compareByLabel);

    return [...folders, ...files];
  }

  private createTagGroups(): havTaskListTagNode[] {
    const groups = new Map<string, havTaskListTask[]>();

    for (const task of this.getVisibleTasks()) {
      const tasks = groups.get(task.label) ?? [];

      tasks.push(task);

      groups.set(task.label, tasks);
    }

    return [...groups.entries()]
      .map(([label, tasks]) => ({
        type: "tag" as const,
        id: label,
        label,
        tasks
      }))
      .sort(compareByLabel);
  }

  private createFlatList(): havTaskListTaskNode[] {
    return this.getVisibleTasks().map((task) => ({
      type: "task",
      task
    }));
  }

  private createRootNodes(): havTaskListTreeNode[] {
    if (this.groupBy === "tag") {
      return this.createTagGroups();
    }

    if (this.groupBy === "flat") {
      return this.createFlatList();
    }

    return this.createFileTree();
  }

  private getChildNodes(element: havTaskListTreeNode): havTaskListTreeNode[] {
    if (element.type === "folder") {
      return element.children;
    }

    if (element.type === "file" || element.type === "tag") {
      return element.tasks.map((task) => ({
        type: "task",
        task,
        parent: element
      }));
    }

    return [];
  }

  private getVisibleTasks(): havTaskListTask[] {
    return this.tasks.filter((task) =>
      matchesTaskFilter(task, this.filterText)
    );
  }

  private collectExpandableNodes(
    nodes: havTaskListTreeNode[],
    expandableNodes: havTaskListTreeNode[]
  ): void {
    for (const node of nodes) {
      if (node.type === "task") {
        continue;
      }

      expandableNodes.push(node);

      this.collectExpandableNodes(this.getChildNodes(node), expandableNodes);
    }
  }
}
