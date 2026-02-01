#!/usr/bin/env bun
/**
 * Install or upgrade required development tools and project dependencies.
 *
 * Usage: bun scripts/install.ts
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import { section, ok, check, exec, run, GREEN, NC } from "./lib.ts";

const PROJECT_ROOT = join(import.meta.dir, "..");

// --- Homebrew ---

section("Installing Development Tools");

if (!check("which", ["brew"])) {
  console.log("Installing Homebrew...");
  const exitCode = exec("/bin/bash", [
    "-c",
    "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)",
  ]);
  if (exitCode !== 0) {
    console.error("Failed to install Homebrew");
    process.exit(1);
  }
} else {
  exec("brew", ["update"], { cwd: PROJECT_ROOT });
}

// --- Brew packages ---

const BREW_PACKAGES = [
  "oven-sh/bun/bun",
  "go-task",
  "semgrep",
  "pulumi",
  "biome",
  "azure-cli",
];

for (const pkg of BREW_PACKAGES) {
  if (check("brew", ["list", pkg])) {
    // Already installed — try upgrade (ignore if already latest)
    exec("brew", ["upgrade", pkg]);
  } else {
    exec("brew", ["install", pkg]);
  }
}

// --- npm globals ---

exec("npm", ["install", "-g", "claude-viz"]);

// --- Project dependencies ---

console.log("");
console.log(`${GREEN}Installing project dependencies...${NC}`);
exec("bun", ["install"], { cwd: PROJECT_ROOT });

// --- Infra dependencies ---

const infraDir = join(PROJECT_ROOT, "infra");
if (existsSync(infraDir)) {
  console.log(`${GREEN}Installing infra dependencies...${NC}`);
  exec("bun", ["install"], { cwd: infraDir });

  const policyPackDir = join(infraDir, "security", "policy-pack");
  if (existsSync(policyPackDir)) {
    console.log(`${GREEN}Installing policy pack dependencies...${NC}`);
    exec("bun", ["install"], { cwd: policyPackDir });
  }
}

ok("All tools and dependencies installed");
