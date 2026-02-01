/**
 * Shared utilities for Taskfile Bun scripts.
 */

import { spawnSync, type SpawnSyncReturns } from "node:child_process";

// ANSI color codes
export const GREEN = "\x1b[0;32m";
export const YELLOW = "\x1b[0;33m";
export const CYAN = "\x1b[0;36m";
export const RED = "\x1b[0;31m";
export const BOLD = "\x1b[1m";
export const NC = "\x1b[0m";

/** Run a command and return stdout (trimmed). Throws on non-zero exit. */
export function run(cmd: string, args: string[], opts?: { cwd?: string; stdin?: string }): string {
  const result = spawnSync(cmd, args, {
    cwd: opts?.cwd,
    input: opts?.stdin,
    encoding: "utf-8",
    stdio: [opts?.stdin ? "pipe" : "inherit", "pipe", "pipe"],
  });
  if (result.status !== 0) {
    const stderr = result.stderr?.trim() ?? "";
    throw new Error(`${cmd} ${args.join(" ")} failed (exit ${result.status})${stderr ? `: ${stderr}` : ""}`);
  }
  return (result.stdout ?? "").trim();
}

/** Run a command, returning stdout or empty string on failure. */
export function tryRun(cmd: string, args: string[], opts?: { cwd?: string }): string {
  const result = spawnSync(cmd, args, {
    cwd: opts?.cwd,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.status !== 0) return "";
  return (result.stdout ?? "").trim();
}

/** Run a command, returning true if exit code is 0. */
export function check(cmd: string, args: string[], opts?: { cwd?: string }): boolean {
  const result = spawnSync(cmd, args, {
    cwd: opts?.cwd,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return result.status === 0;
}

/** Run a command with inherited stdio (user sees output). Returns exit code. */
export function exec(cmd: string, args: string[], opts?: { cwd?: string }): number {
  const result = spawnSync(cmd, args, {
    cwd: opts?.cwd,
    encoding: "utf-8",
    stdio: "inherit",
  });
  return result.status ?? 1;
}

/** Print a success line: ✓ message */
export function ok(msg: string): void {
  console.log(`  ${GREEN}✓${NC} ${msg}`);
}

/** Print a warning line: ? message */
export function warn(msg: string): void {
  console.log(`  ${YELLOW}?${NC} ${msg}`);
}

/** Print a failure line: ✗ message */
export function fail(msg: string): void {
  console.log(`  ${RED}✗${NC} ${msg}`);
}

/** Print a skip line: ⊘ message */
export function skip(msg: string): void {
  console.log(`  ${YELLOW}⊘${NC} ${msg}`);
}

/** Print a section header. */
export function section(msg: string): void {
  console.log(`${CYAN}${msg}${NC}`);
}

/** Fatal error — print and exit. */
export function fatal(msg: string): never {
  console.error(`${RED}Error:${NC} ${msg}`);
  process.exit(1);
}

/** Require a CLI tool to be available. */
export function requireCmd(name: string, installHint?: string): void {
  if (!check("command", ["-v", name])) {
    // `command -v` may not work via spawnSync; fall back to `which`
    if (!check("which", [name])) {
      fatal(`${name} is not installed.${installHint ? ` ${installHint}` : ""}`);
    }
  }
}
