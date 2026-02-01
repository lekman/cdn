#!/usr/bin/env bun
/**
 * Configure GitHub repository secrets for CI/CD.
 * Resolves values from 1Password when available, otherwise prompts interactively.
 *
 * Usage: bun scripts/setup-repo.ts
 */

import { createInterface } from "node:readline";
import {
  section, ok, fail, skip, fatal, requireCmd,
  check, run, tryRun, exec,
  GREEN, YELLOW, CYAN, RED, BOLD, NC,
} from "./lib.ts";

const SECRETS = [
  "CODECOV_TOKEN",
  "RELEASE_BOT_APP_ID",
  "RELEASE_BOT_PRIVATE_KEY",
  "CLAUDE_CODE_OAUTH_TOKEN",
];

// --- Prerequisites ---

section("GitHub Repository Secret Configuration");

requireCmd("gh", "Install from: https://cli.github.com");

if (!check("gh", ["auth", "status"])) {
  console.log(`${YELLOW}Not logged in to GitHub. Launching login...${NC}`);
  exec("gh", ["auth", "login", "-p", "ssh", "--skip-ssh-key"]);
}

// Ensure gh uses SSH protocol
const currentProto = tryRun("gh", ["config", "get", "git_protocol"]);
if (currentProto !== "ssh") {
  run("gh", ["config", "set", "git_protocol", "ssh"]);
  ok("Set gh git_protocol to ssh");
}

// --- Resolve secrets from 1Password ---

const resolvedEnv: Record<string, string> = {};

if (check("which", ["op"])) {
  console.log(`${GREEN}1Password CLI detected${NC}`);
  try {
    const exportFile = run("task", ["op:export"]);
    if (exportFile) {
      // Source the export file to get resolved values
      const content = await Bun.file(exportFile).text();
      for (const line of content.split("\n")) {
        const match = line.match(/^export\s+(\w+)=["']?(.+?)["']?$/);
        if (match) {
          resolvedEnv[match[1]] = match[2];
        }
      }
      console.log(`${GREEN}Secrets resolved from 1Password${NC}`);
    }
  } catch {
    console.log(`${YELLOW}Could not resolve secrets from 1Password (task op:export failed)${NC}`);
  }
} else {
  console.log(`${YELLOW}1Password CLI not found — will prompt for values${NC}`);
}

// Prevent sourced tokens from overriding gh CLI auth
delete resolvedEnv.GITHUB_TOKEN;
delete resolvedEnv.GH_TOKEN;

console.log("");

// --- Detect repo ---

const repo = tryRun("gh", ["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"]);
if (!repo) {
  fatal("Could not detect GitHub repository. Run from inside a git repo with a GitHub remote.");
}
console.log(`Repository: ${GREEN}${repo}${NC}`);
console.log("");

// --- Get existing secrets ---

const existingRaw = tryRun("gh", ["secret", "list", "--repo", repo, "--json", "name", "--jq", ".[].name"]);
const existing = new Set(existingRaw.split("\n").filter(Boolean));

let configured = 0;
let skipped = 0;
let failed = 0;

// --- Helper: read a line from stdin ---

function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

/** Read multiline PEM input until an empty line. */
function readPem(): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    let value = "";
    console.log(`    ${CYAN}Paste PEM private key (end with empty line):${NC}`);
    rl.on("line", (line) => {
      if (line === "") {
        rl.close();
        resolve(value);
      } else {
        value += line + "\n";
      }
    });
  });
}

// --- Set secrets ---

for (const secret of SECRETS) {
  if (existing.has(secret)) {
    ok(`${secret} (already configured)`);
    skipped++;
    continue;
  }

  // Try resolved env value
  const value = resolvedEnv[secret];
  if (value && !value.startsWith("op://")) {
    if (check("gh", ["secret", "set", secret, "--repo", repo, "--body", value])) {
      ok(`${secret} (set from 1Password)`);
      configured++;
    } else {
      fail(`${secret} (failed to set)`);
      failed++;
    }
    continue;
  }

  // Interactive prompt
  warn(`${secret} — no resolved value available`);

  if (secret === "RELEASE_BOT_PRIVATE_KEY") {
    const pemValue = await readPem();
    if (pemValue) {
      try {
        run("gh", ["secret", "set", secret, "--repo", repo], { stdin: pemValue });
        ok(`${secret} (set from input)`);
        configured++;
      } catch {
        fail(`${secret} (failed to set)`);
        failed++;
      }
    } else {
      skip(`${secret} (skipped)`);
      failed++;
    }
  } else {
    const inputValue = await prompt("    Enter value (or press Enter to skip): ");
    if (inputValue) {
      if (check("gh", ["secret", "set", secret, "--repo", repo, "--body", inputValue])) {
        ok(`${secret} (set from input)`);
        configured++;
      } else {
        fail(`${secret} (failed to set)`);
        failed++;
      }
    } else {
      skip(`${secret} (skipped)`);
      failed++;
    }
  }
}

// --- Summary ---

console.log("");
console.log(`${BOLD}Summary:${NC}`);
console.log(`  Configured: ${GREEN}${configured}${NC}`);
console.log(`  Existing:   ${YELLOW}${skipped}${NC}`);
console.log(`  Remaining:  ${RED}${failed}${NC}`);

if (failed > 0) {
  console.log("");
  console.log(`${YELLOW}Re-run 'task setup:repo' after resolving remaining secrets${NC}`);
} else {
  console.log("");
  ok("All repository secrets configured");
}
