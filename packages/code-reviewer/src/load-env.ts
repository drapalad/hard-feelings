import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageSrcDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(packageSrcDir, "../../..");

function applyEnvFile(filePath: string): void {
  if (!existsSync(filePath)) {
    return;
  }

  const text = readFileSync(filePath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq);
    if (process.env[key]) {
      continue;
    }
    let value = trimmed.slice(eq + 1);
    const quoted = (value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"));
    if (quoted) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

/** Load repo-root `.dev.vars` / `.env` without overriding existing process env. CLI only. */
export function loadLocalEnv(): void {
  applyEnvFile(path.join(process.cwd(), ".dev.vars"));
  applyEnvFile(path.join(process.cwd(), ".env"));
  applyEnvFile(path.join(repoRoot, ".dev.vars"));
  applyEnvFile(path.join(repoRoot, ".env"));
}
