import { spawn } from "node:child_process";

const current = process.env.NODE_OPTIONS ?? "";
if (!current.includes("--experimental-sqlite")) {
  process.env.NODE_OPTIONS = `${current} --experimental-sqlite`.trim();
}

const args = process.argv.slice(2);
if (!args.length) {
  console.error("Укажите команду для запуска.");
  process.exit(1);
}

const child = spawn(args[0], args.slice(1), {
  stdio: "inherit",
  env: process.env,
  shell: process.platform === "win32",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
