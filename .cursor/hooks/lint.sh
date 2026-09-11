#!/usr/bin/env bash
# After an agent edit, ESLint --fix the changed file. Fail-open: inject output, do not block.

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

if ! printf '%s' "$rel" | grep -Eq '\.(ts|tsx|astro)$'; then
  printf '%s\n' '{}'
  exit 0
fi

if [ ! -f "$file" ] && [ ! -f "$root/$rel" ]; then
  printf '%s\n' '{}'
  exit 0
fi

target=$file
if [ ! -f "$target" ]; then
  target="$root/$rel"
fi

out=$(mktemp)
trap 'rm -f "$out"' EXIT

set +e
npx eslint --fix --quiet "$target" >"$out" 2>&1
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
    additional_context: `Lint failed for ${rel}. Fix the ESLint findings before continuing.\n\n${output}`,
  }),
);
' <"$out"
exit 0
