/*---------------------------------------------------------
 * Copyright (c) 2026 René Nicolaus.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------*/

import { havTaskListConfig, havTaskListRule, havTaskListTask } from "./types";

function compileRegex(pattern: string): RegExp | undefined {
  try {
    return new RegExp(pattern, "i");
  } catch {
    return undefined;
  }
}

function ruleAppliesToFile(rule: havTaskListRule, file: string): boolean {
  if (!rule.filePattern) {
    return true;
  }

  return compileRegex(rule.filePattern)?.test(file) ?? false;
}

function taskMatchRange(
  match: RegExpExecArray,
  label: string
): { column: number; match: string } {
  const labelIndex = match[0].toLowerCase().indexOf(label.toLowerCase());

  if (labelIndex < 0) {
    return {
      column: match.index,
      match: match[0]
    };
  }

  return {
    column: match.index + labelIndex,
    match: match[0].slice(labelIndex)
  };
}

export function hasActiveRuleForFile(
  file: string,
  config: havTaskListConfig
): boolean {
  return config.rules.some(
    (rule) => rule.severity !== "off" && ruleAppliesToFile(rule, file)
  );
}

export function scanContent(
  content: string,
  file: string,
  relativeFile: string,
  config: havTaskListConfig
): havTaskListTask[] {
  const tasks: havTaskListTask[] = [];

  const lines = content.split(/\r?\n/);

  for (const rule of config.rules) {
    if (rule.severity === "off" || !ruleAppliesToFile(rule, relativeFile)) {
      continue;
    }

    const regex = compileRegex(rule.pattern);

    if (!regex) {
      continue;
    }

    for (let index = 0; index < lines.length; ++index) {
      const line = lines[index];

      const match = regex.exec(line);
      if (!match) {
        continue;
      }

      const label = rule.label ?? rule.id;
      const taskMatch = taskMatchRange(match, label);

      tasks.push({
        file,
        relativeFile,
        line: index,
        column: taskMatch.column,
        ruleId: rule.id,
        label,
        match: taskMatch.match,
        text: (match[1] ?? match[0]).trim(),
        severity: rule.severity,
        color: rule.color
      });
    }
  }

  return tasks;
}
