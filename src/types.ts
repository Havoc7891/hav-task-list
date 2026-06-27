/*---------------------------------------------------------
 * Copyright (c) 2026 René Nicolaus.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------*/

export type havTaskListSeverity = "off" | "info" | "warning" | "error";
export type havTaskListGroupBy = "file" | "tag" | "flat";

export interface havTaskListRule {
  id: string;
  label?: string;
  pattern: string;
  severity: havTaskListSeverity;
  color?: string;
  filePattern?: string;
}

export interface havTaskListConfig {
  rules: havTaskListRule[];
  includeGlobs: string[];
  excludeGlobs: string[];
  maxFileSizeKb: number;
  showDiagnostics: boolean;
  showEditorHighlights: boolean;
  groupBy: havTaskListGroupBy;
}

export interface havTaskListTask {
  file: string;
  relativeFile: string;
  line: number;
  column: number;
  ruleId: string;
  label: string;
  match: string;
  text: string;
  severity: Exclude<havTaskListSeverity, "off">;
  color?: string;
}
