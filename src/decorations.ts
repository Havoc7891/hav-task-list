/*---------------------------------------------------------
 * Copyright (c) 2026 René Nicolaus.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------*/

import * as vscode from "vscode";
import { havTaskListTask } from "./types";

function severityColor(task: havTaskListTask): string {
  if (task.severity === "error") {
    return "editorError.foreground";
  }

  if (task.severity === "warning") {
    return "editorWarning.foreground";
  }

  return "editorInfo.foreground";
}

function taskColor(task: havTaskListTask): string {
  return task.color ?? severityColor(task);
}

function tagRange(task: havTaskListTask): vscode.Range {
  const match = task.match.toLowerCase();
  const label = task.label.toLowerCase();
  const labelIndex = label ? match.indexOf(label) : -1;
  const startOffset = labelIndex >= 0 ? labelIndex : 0;
  const length = labelIndex >= 0 ? task.label.length : task.match.length;
  const startColumn = task.column + startOffset;

  return new vscode.Range(
    task.line,
    startColumn,
    task.line,
    startColumn + Math.max(length, 1)
  );
}

function rangesByColor(tasks: havTaskListTask[]): Map<string, vscode.Range[]> {
  const ranges = new Map<string, vscode.Range[]>();

  for (const task of tasks) {
    const color = taskColor(task);
    const colorRanges = ranges.get(color) ?? [];

    colorRanges.push(tagRange(task));
    ranges.set(color, colorRanges);
  }

  return ranges;
}

export class havTaskListDecorations {
  private readonly decorationTypes = new Map<
    string,
    vscode.TextEditorDecorationType
  >();

  private tasks: havTaskListTask[] = [];
  private enabled = true;

  update(tasks: havTaskListTask[], enabled: boolean): void {
    this.tasks = tasks;
    this.enabled = enabled;

    this.refreshVisibleEditors();
  }

  refreshVisibleEditors(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      this.updateEditor(editor);
    }
  }

  dispose(): void {
    for (const decorationType of this.decorationTypes.values()) {
      decorationType.dispose();
    }

    this.decorationTypes.clear();
  }

  private decorationType(color: string): vscode.TextEditorDecorationType {
    const existingDecorationType = this.decorationTypes.get(color);
    if (existingDecorationType) {
      return existingDecorationType;
    }

    const themeColor = new vscode.ThemeColor(color);
    const decorationType = vscode.window.createTextEditorDecorationType({
      color: themeColor,
      fontWeight: "600",
      overviewRulerColor: themeColor,
      overviewRulerLane: vscode.OverviewRulerLane.Right,
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed
    });

    this.decorationTypes.set(color, decorationType);

    return decorationType;
  }

  private updateEditor(editor: vscode.TextEditor): void {
    for (const decorationType of this.decorationTypes.values()) {
      editor.setDecorations(decorationType, []);
    }

    if (!this.enabled) {
      return;
    }

    const editorTasks = this.tasks.filter(
      (task) => task.file === editor.document.uri.fsPath
    );

    for (const [color, ranges] of rangesByColor(editorTasks)) {
      editor.setDecorations(this.decorationType(color), ranges);
    }
  }
}
