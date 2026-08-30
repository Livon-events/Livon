/**
 * Dev wrapper that hides known-harmless Watchpack noise on Windows.
 *
 * Watchpack sometimes lstats protected drive-root files (pagefile.sys, etc.).
 * Those EINVAL lines are unrelated to the Livon project tree. Any other
 * Watchpack / Next / Node stderr still passes through unchanged.
 *
 * Escape hatch: `npm run dev:raw` runs `next dev` with no filtering.
 */
import { spawn } from "node:child_process";

const HARMLESS_WATCHPACK =
  /Watchpack Error.*(?:DumpStack\.log\.tmp|System Volume Information|hiberfil\.sys|pagefile\.sys|swapfile\.sys)/i;

const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "dev", "--turbopack", ...process.argv.slice(2)],
  {
  cwd: process.cwd(),
  env: process.env,
  stdio: ["inherit", "inherit", "pipe"],
  }
);

let stderrBuf = "";

child.stderr?.on("data", (chunk) => {
  stderrBuf += chunk.toString("utf8");
  const parts = stderrBuf.split(/\r?\n/);
  stderrBuf = parts.pop() ?? "";

  for (const line of parts) {
    if (HARMLESS_WATCHPACK.test(line)) continue;
    process.stderr.write(line + "\n");
  }
});

child.stderr?.on("end", () => {
  if (stderrBuf.length > 0 && !HARMLESS_WATCHPACK.test(stderrBuf)) {
    process.stderr.write(stderrBuf);
  }
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    child.kill(signal);
  });
}
