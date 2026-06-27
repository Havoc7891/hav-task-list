/*---------------------------------------------------------
 * Copyright (c) 2026 René Nicolaus.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------*/

import * as path from "path";
import * as vscode from "vscode";
import { hasActiveRuleForFile, scanContent } from "./scanner";
import { havTaskListConfig, havTaskListTask } from "./types";

function toExcludeGlob(excludeGlobs: string[]): string | undefined {
  if (excludeGlobs.length === 0) {
    return undefined;
  }

  if (excludeGlobs.length === 1) {
    return excludeGlobs[0];
  }

  return `{${excludeGlobs.join(",")}}`;
}

function getRelativeFile(uri: vscode.Uri): string {
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
  if (!workspaceFolder) {
    return path.basename(uri.fsPath);
  }

  return path
    .relative(workspaceFolder.uri.fsPath, uri.fsPath)
    .replace(/\\/g, "/");
}

async function scanFile(
  uri: vscode.Uri,
  config: havTaskListConfig
): Promise<havTaskListTask[]> {
  const relativeFile = getRelativeFile(uri);
  if (!hasActiveRuleForFile(relativeFile, config)) {
    return [];
  }

  const configuredMaxFileSizeKb = Number.isFinite(config.maxFileSizeKb)
    ? Math.max(0, config.maxFileSizeKb)
    : 0;
  const maxBytes = configuredMaxFileSizeKb * 1024;

  try {
    const stat = await vscode.workspace.fs.stat(uri);
    if (stat.size > maxBytes) {
      return [];
    }

    const bytes = await vscode.workspace.fs.readFile(uri);

    const content = Buffer.from(bytes).toString("utf8");
    if (content.includes("\0")) {
      return [];
    }

    return scanContent(content, uri.fsPath, relativeFile, config);
  } catch {
    return [];
  }
}

export async function scanWorkspaceTasks(
  config: havTaskListConfig
): Promise<havTaskListTask[]> {
  const includeGlobs =
    config.includeGlobs.length > 0 ? config.includeGlobs : ["**/*"];
  const excludeGlob = toExcludeGlob(config.excludeGlobs);

  const files = new Map<string, vscode.Uri>();

  for (const includeGlob of includeGlobs) {
    const foundFiles = await vscode.workspace.findFiles(
      includeGlob,
      excludeGlob
    );

    for (const file of foundFiles) {
      files.set(file.toString(), file);
    }
  }

  const taskGroups = await Promise.all(
    [...files.values()].map((file) => scanFile(file, config))
  );

  return taskGroups
    .flat()
    .sort(
      (left, right) =>
        left.relativeFile.localeCompare(right.relativeFile) ||
        left.line - right.line ||
        left.column - right.column ||
        left.ruleId.localeCompare(right.ruleId)
    );
}
