/*---------------------------------------------------------
 * Copyright (c) 2026 René Nicolaus.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------*/

import * as vscode from "vscode";
import { appName } from "./strings/ui";
import { havTaskListTask } from "./types";

function toDiagnosticSeverity(
  severity: havTaskListTask["severity"]
): vscode.DiagnosticSeverity {
  if (severity === "error") {
    return vscode.DiagnosticSeverity.Error;
  }

  if (severity === "warning") {
    return vscode.DiagnosticSeverity.Warning;
  }

  return vscode.DiagnosticSeverity.Information;
}

export class havTaskListDiagnostics {
  private readonly diagnosticCollection =
    vscode.languages.createDiagnosticCollection("havTaskList");

  dispose(): void {
    this.diagnosticCollection.dispose();
  }

  update(tasks: havTaskListTask[]): void {
    this.diagnosticCollection.clear();

    const files = new Map<string, vscode.Diagnostic[]>();

    for (const task of tasks) {
      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(
          task.line,
          task.column,
          task.line,
          task.column + Math.max(task.match.length, 1)
        ),
        `${task.label}: ${task.text || task.match}`,
        toDiagnosticSeverity(task.severity)
      );

      diagnostic.source = appName;
      diagnostic.code = task.ruleId;

      const diagnostics = files.get(task.file) ?? [];
      diagnostics.push(diagnostic);

      files.set(task.file, diagnostics);
    }

    for (const [file, fileDiagnostics] of files) {
      this.diagnosticCollection.set(vscode.Uri.file(file), fileDiagnostics);
    }
  }
}
