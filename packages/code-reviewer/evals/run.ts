import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "../src/load-env";

loadLocalEnv();

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const promptfooEntry = [
  path.join(packageDir, "node_modules/promptfoo/dist/src/main.js"),
  path.join(packageDir, "../../node_modules/promptfoo/dist/src/main.js"),
].find((candidate) => existsSync(candidate));

if (!promptfooEntry) {
  throw new Error("promptfoo is not installed. Run npm install from the repo root.");
}

const child = spawn(process.execPath, [promptfooEntry, "eval", "-c", "promptfooconfig.yaml"], {
  cwd: packageDir,
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
