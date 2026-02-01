#!/usr/bin/env bun
/**
 * Opens the latest Claude Code plan in claude-viz and tracks all plans
 * in .tmp/claude.plans.json for history/lookup.
 *
 * Usage: bun scripts/open-plan.ts
 */

import { readdir, stat, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, basename } from "node:path";
import { execSync, spawn } from "node:child_process";
import { homedir } from "node:os";

const PLANS_DIR = join(homedir(), ".claude", "plans");
const PROJECT_ROOT = join(import.meta.dir, "..");
const TRACKER_PATH = join(PROJECT_ROOT, ".tmp", "claude.plans.json");
const VIZ_PORT = 8888;
const VIZ_URL = `http://localhost:${VIZ_PORT}`;

interface PlanEntry {
  name: string;
  id: string;
  path: string;
}

/** Read the existing tracker file, or return an empty array. */
async function readTracker(): Promise<PlanEntry[]> {
  try {
    const raw = await readFile(TRACKER_PATH, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PlanEntry[]) : [];
  } catch {
    return [];
  }
}

/** Write the tracker file, creating .tmp/ if needed. */
async function writeTracker(entries: PlanEntry[]): Promise<void> {
  await mkdir(join(PROJECT_ROOT, ".tmp"), { recursive: true });
  await writeFile(TRACKER_PATH, JSON.stringify(entries, null, 2) + "\n");
}

/** Find the most recently modified plan file. */
async function findLatestPlan(): Promise<string | null> {
  let files: string[];
  try {
    files = await readdir(PLANS_DIR);
  } catch {
    return null;
  }

  const mdFiles = files.filter((f) => f.endsWith(".md"));
  if (mdFiles.length === 0) return null;

  let latest = "";
  let latestMtime = 0;

  for (const file of mdFiles) {
    const fullPath = join(PLANS_DIR, file);
    const info = await stat(fullPath);
    if (info.mtimeMs > latestMtime) {
      latestMtime = info.mtimeMs;
      latest = fullPath;
    }
  }

  return latest || null;
}

/** Extract a human-readable name from the first heading line of a plan. */
async function extractPlanName(filePath: string): Promise<string> {
  try {
    const content = await readFile(filePath, "utf-8");
    const firstLine = content.split("\n")[0] ?? "";
    // Strip leading markdown heading markers and whitespace
    const cleaned = firstLine.replace(/^#+\s*/, "").trim();
    return cleaned || basename(filePath, ".md");
  } catch {
    return basename(filePath, ".md");
  }
}

/** Check whether claude-viz is already listening. */
function isVizRunning(): boolean {
  try {
    execSync(`lsof -i :${VIZ_PORT} -sTCP:LISTEN`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/** Start claude-viz in the background. */
function startViz(): void {
  const child = spawn("claude-viz", [], {
    stdio: "ignore",
    detached: true,
  });
  child.unref();
}

/** Open a URL in the default browser. */
function openBrowser(url: string): void {
  spawn("open", [url], { stdio: "ignore" }).unref();
}

// --- main ---

const latestPlan = await findLatestPlan();

if (latestPlan) {
  const id = basename(latestPlan, ".md");
  const name = await extractPlanName(latestPlan);

  const entries = await readTracker();

  // Upsert: update existing entry or append
  const idx = entries.findIndex((e) => e.id === id);
  const entry: PlanEntry = { name, id, path: latestPlan };

  if (idx >= 0) {
    entries[idx] = entry;
  } else {
    entries.push(entry);
  }

  await writeTracker(entries);
  console.log(`Tracked plan: ${name} (${id})`);
} else {
  console.log("No plan files found in ~/.claude/plans/");
}

if (!isVizRunning()) {
  startViz();
  // Give claude-viz a moment to start listening
  await Bun.sleep(1000);
}

openBrowser(VIZ_URL);
