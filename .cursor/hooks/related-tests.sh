#!/usr/bin/env bash
# After an agent edit, run only Vitest files that import the changed module.
# Scoped to test-plan risks #1 / #2 / #6 (services + product API). Fail-open.

set -euo pipefail

input=$(cat)
file=$(printf '%s' "$input" | node --input-type=module -e '
let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  raw += chunk;
});
process.stdin.on("end", () => {
  try {
    const payload = JSON.parse(raw);
    process.stdout.write(String(payload.file_path ?? payload.tool_input?.file_path ?? ""));
  } catch {
    process.stdout.write("");
  }
});
')

if [ -z "$file" ]; then
  printf '%s\n' '{}'
  exit 0
fi

root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
rel=${file#"$root"/}

if ! printf '%s' "$rel" | grep -Eq '^src/(lib/services|pages/api)/.+\.(ts|tsx)$'; then
  printf '%s\n' '{}'
  exit 0
fi

out=$(mktemp)
trap 'rm -f "$out"' EXIT

set +e
AI_AGENT=1 npx vitest related --run --passWithNoTests "$file" >"$out" 2>&1
status=$?
set -e

if [ "$status" -eq 0 ]; then
  printf '%s\n' '{}'
  exit 0
fi

cat "$out" >&2
HF_REL="$rel" node --input-type=module -e '
import { readFileSync } from "node:fs";
const rel = process.env.HF_REL ?? "";
const output = readFileSync(0, "utf8");
process.stdout.write(
  JSON.stringify({
    additional_context: `Related tests failed for ${rel}. Fix the failing tests before continuing.\n\n${output}`,
  }),
);
' <"$out"
exit 0
