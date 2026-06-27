/*---------------------------------------------------------
 * Copyright (c) 2026 René Nicolaus.
 * Licensed under the MIT License. See LICENSE in the project root for license information.
 *--------------------------------------------------------*/

import { havTaskListRule } from "./types";

const defaultTaskFilePattern =
  "\\.(js|jsx|ts|tsx|vue|svelte|c|cc|cpp|cxx|h|hpp|hh|hxx|cs|csx|py|rb|php|go|rs|java|kt|kts|swift|m|mm|scala|sh|bash|zsh|fish|ps1|psm1|sql|html|css|scss|less|md|mdx|json|jsonc|yaml|yml|toml|ini|cmake|gradle|dockerfile)$";

export const defaultRules: havTaskListRule[] = [
  {
    id: "todo",
    label: "TODO",
    pattern:
      "(?:^|\\s)(?://|#|<!--|/\\*|\\*|--|;|-)\\s*\\bTODO\\b(?::\\s*|\\s+)(.*)",
    severity: "info",
    color: "charts.blue",
    filePattern: defaultTaskFilePattern
  },
  {
    id: "fixme",
    label: "FIXME",
    pattern:
      "(?:^|\\s)(?://|#|<!--|/\\*|\\*|--|;|-)\\s*\\bFIXME\\b(?::\\s*|\\s+)(.*)",
    severity: "warning",
    color: "charts.yellow",
    filePattern: defaultTaskFilePattern
  },
  {
    id: "hack",
    label: "HACK",
    pattern:
      "(?:^|\\s)(?://|#|<!--|/\\*|\\*|--|;|-)\\s*\\bHACK\\b(?::\\s*|\\s+)(.*)",
    severity: "warning",
    color: "charts.orange",
    filePattern: defaultTaskFilePattern
  },
  {
    id: "bug",
    label: "BUG",
    pattern:
      "(?:^|\\s)(?://|#|<!--|/\\*|\\*|--|;|-)\\s*\\bBUG\\b(?::\\s*|\\s+)(.*)",
    severity: "error",
    color: "charts.red",
    filePattern: defaultTaskFilePattern
  },
  {
    id: "note",
    label: "NOTE",
    pattern:
      "(?:^|\\s)(?://|#|<!--|/\\*|\\*|--|;|-)\\s*\\bNOTE\\b(?::\\s*|\\s+)(.*)",
    severity: "info",
    color: "charts.green",
    filePattern: defaultTaskFilePattern
  }
];
