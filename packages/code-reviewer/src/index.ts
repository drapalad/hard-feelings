import { loadLocalEnv } from "./load-env";
import { reviewDiff } from "./agent";

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) {
    return "";
  }

  let diff = "";
  for await (const chunk of process.stdin) {
    diff += typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
  }
  return diff;
}

async function main(): Promise<void> {
  loadLocalEnv();

  const diff = (await readStdin()).trim();
  if (diff.length === 0) {
    process.stderr.write("Usage: git diff | npm run review --workspace=code-reviewer\n");
    process.exitCode = 1;
    return;
  }

  const output = await reviewDiff(diff);
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
