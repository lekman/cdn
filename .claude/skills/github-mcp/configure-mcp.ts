#!/usr/bin/env bun

/**
 * Configure GitHub MCP Server with 1Password Integration
 *
 * Supports both global and local (project-specific) MCP configuration.
 * Fetches GITHUB_TOKEN from 1Password using op:// reference.
 *
 * Usage:
 *   bun configure-mcp.ts                  # Auto-detect (local if .env exists)
 *   bun configure-mcp.ts --local          # Force local project config
 *   bun configure-mcp.ts --global         # Force global user config
 *   bun configure-mcp.ts --reauth         # Reauthenticate
 *   bun configure-mcp.ts --allow-patterns # Add global allow patterns for MCP tools
 *
 * Requirements:
 * - 1Password CLI (op) must be installed
 * - .env file with GITHUB_TOKEN=op://Private/GitHub.com/GITHUB_TOKEN
 *
 * Configuration scopes:
 * - Global: ~/.claude.json (shared across all projects)
 * - Local: .claude/mcp.json (project-specific, gitignored)
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CLAUDE_GLOBAL_CONFIG = join(homedir(), ".claude.json");
const CLAUDE_LOCAL_CONFIG = join(process.cwd(), ".claude", "mcp.json");
const CLAUDE_SETTINGS = join(homedir(), ".claude", "settings.json");
const ENV_FILE = join(process.cwd(), ".env");
const OP_TIMEOUT_MS = 30000; // 30 second timeout

interface McpServerConfig {
  type: "http" | "stdio";
  url?: string;
  headers?: Record<string, string>;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
}

interface McpSettings {
  mcpServers: Record<string, McpServerConfig>;
}

interface ClaudeSettings {
  allowedTools?: string[];
  [key: string]: unknown;
}

function checkOpInstalled(): boolean {
  const result = spawnSync("which", ["op"], { encoding: "utf-8" });
  return result.status === 0;
}

function readEnvFile(): Map<string, string> {
  if (!existsSync(ENV_FILE)) {
    throw new Error(`.env file not found at ${ENV_FILE}`);
  }

  const envVars = new Map<string, string>();
  const content = readFileSync(ENV_FILE, "utf-8");

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0) {
        envVars.set(key.trim(), valueParts.join("=").trim());
      }
    }
  }

  return envVars;
}

function fetchFromOnePassword(opReference: string): string {
  console.log(`Fetching secret from 1Password: ${opReference}`);
  console.log("⏱  30 second timeout - please authenticate with 1Password...\n");

  const result = spawnSync("op", ["read", opReference], {
    encoding: "utf-8",
    timeout: OP_TIMEOUT_MS,
    stdio: ["inherit", "pipe", "pipe"],
  });

  if (result.error) {
    if (result.error.message.includes("ETIMEDOUT")) {
      throw new Error("Timeout: 1Password authentication not completed within 30 seconds");
    }
    throw new Error(`Failed to execute 1Password CLI: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const errorMsg = result.stderr?.trim() || "Unknown error";
    throw new Error(`1Password CLI failed: ${errorMsg}`);
  }

  const token = result.stdout?.trim();
  if (!token) {
    throw new Error("1Password returned empty token");
  }

  console.log("✓ Successfully fetched token from 1Password\n");
  return token;
}

function getGitHubToken(): string {
  console.log("Reading .env file...");
  const envVars = readEnvFile();

  const githubTokenRef = envVars.get("GITHUB_TOKEN");
  if (!githubTokenRef) {
    throw new Error("GITHUB_TOKEN not found in .env file");
  }

  console.log(`Found GITHUB_TOKEN reference: ${githubTokenRef}\n`);

  // Check if it's a 1Password reference
  if (githubTokenRef.startsWith("op://")) {
    if (!checkOpInstalled()) {
      throw new Error(
        "1Password CLI (op) is not installed. Install from: https://developer.1password.com/docs/cli/get-started/"
      );
    }

    return fetchFromOnePassword(githubTokenRef);
  }

  // Plain text token (not recommended, but supported)
  console.log("⚠ WARNING: Using plain text token from .env file");
  console.log("⚠ Recommended: Use 1Password reference (op://vault/item/field)\n");
  return githubTokenRef;
}

function readConfig(configPath: string): McpSettings {
  if (!existsSync(configPath)) {
    console.log(`No existing config found at ${configPath}, creating new file`);
    return { mcpServers: {} };
  }

  try {
    const content = readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(content);

    // Normalize: ensure mcpServers exists even if config file lacks it
    if (typeof parsed !== "object" || parsed === null) {
      return { mcpServers: {} };
    }

    return {
      ...parsed,
      mcpServers: parsed.mcpServers ?? {},
    } as McpSettings;
  } catch (error) {
    console.error(
      `Error parsing existing config: ${error instanceof Error ? error.message : String(error)}`
    );
    console.log("Creating new configuration");
    return { mcpServers: {} };
  }
}

function writeConfig(configPath: string, settings: McpSettings): void {
  // Ensure directory exists for local config
  const dir = join(configPath, "..");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const content = JSON.stringify(settings, null, 2);
  writeFileSync(configPath, content, "utf-8");
  console.log(`✓ Updated ${configPath}`);
}

function readSettings(): ClaudeSettings {
  if (!existsSync(CLAUDE_SETTINGS)) {
    return {};
  }

  try {
    const content = readFileSync(CLAUDE_SETTINGS, "utf-8");
    return JSON.parse(content) as ClaudeSettings;
  } catch (error) {
    console.error(
      `Error parsing settings: ${error instanceof Error ? error.message : String(error)}`
    );
    return {};
  }
}

function writeSettings(settings: ClaudeSettings): void {
  const dir = join(CLAUDE_SETTINGS, "..");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const content = JSON.stringify(settings, null, 2);
  writeFileSync(CLAUDE_SETTINGS, content, "utf-8");
  console.log(`✓ Updated ${CLAUDE_SETTINGS}`);
}

function addAllowPatterns(): void {
  console.log("Adding global allow patterns for GitHub MCP tools\n");

  const settings = readSettings();

  // GitHub MCP tool patterns
  const githubMcpPatterns = [
    "mcp__github__*", // All GitHub MCP tools
  ];

  // Merge with existing allowed tools
  const existingTools = settings.allowedTools ?? [];
  const newTools = [...new Set([...existingTools, ...githubMcpPatterns])];

  settings.allowedTools = newTools;
  writeSettings(settings);

  console.log("\n✓ GitHub MCP tools added to allowed patterns:");
  githubMcpPatterns.forEach((pattern) => {
    console.log(`  • ${pattern}`);
  });

  console.log("\n✓ GitHub MCP tools will now run without permission prompts");
}

function reauthenticate(useLocal: boolean): void {
  console.log("Reauthenticating GitHub MCP Server\n");

  const configPath = useLocal ? CLAUDE_LOCAL_CONFIG : CLAUDE_GLOBAL_CONFIG;

  // Remove the MCP server using Claude CLI to clear stored config
  console.log("Removing existing configuration...");
  const removeResult = spawnSync("claude", ["mcp", "remove", "github"], {
    stdio: "inherit",
    shell: true,
  });

  if (removeResult.status !== 0) {
    console.error("⚠ Failed to remove GitHub MCP server");
    console.log("Continuing with reconfiguration...\n");
  } else {
    console.log("✓ Cleared existing configuration\n");
  }

  // Reconfigure with fresh token
  configure(useLocal);
}

function configure(useLocal: boolean): void {
  const configPath = useLocal ? CLAUDE_LOCAL_CONFIG : CLAUDE_GLOBAL_CONFIG;
  const scope = useLocal ? "project-local" : "global";

  console.log(`Configuring GitHub MCP Server (${scope} configuration)\n`);

  try {
    // Fetch GitHub token from 1Password
    const githubToken = getGitHubToken();

    const settings = readConfig(configPath);

    // Check if GitHub MCP is already configured
    if (settings.mcpServers.github) {
      console.log("⚠ GitHub MCP server already configured");
      console.log("Overwriting with new configuration...\n");
    }

    // Configure GitHub MCP with Authorization header
    const githubMcpConfig: McpServerConfig = {
      type: "http",
      url: "https://api.githubcopilot.com/mcp/",
      headers: {
        Authorization: `Bearer ${githubToken}`,
      },
    };

    settings.mcpServers.github = githubMcpConfig;
    writeConfig(configPath, settings);

    console.log("\n✓ GitHub MCP server configured successfully");
    console.log(`\nConfiguration (${scope}):`);
    console.log(`  Config file: ${configPath}`);
    console.log("  Server: github");
    console.log("  Type: http");
    console.log("  URL: https://api.githubcopilot.com/mcp/");
    console.log("  Auth: Token configured (source: 1Password)");

    if (useLocal) {
      console.log("\n✓ Local configuration created:");
      console.log("  • Token is specific to this project");
      console.log("  • Config file is gitignored (.claude/mcp.json)");
      console.log("  • Other projects use their own tokens");
    }

    console.log("\nNext steps:");
    console.log("1. Restart Claude Code with: claude -c");
    console.log("2. GitHub MCP tools should now be available");
    console.log("3. Optional: Run with --allow-patterns to add global allow patterns");

    console.log(`\n⚠ IMPORTANT: Token is stored in ${configPath}`);
    console.log("⚠ Keep this file secure and never commit to version control");
  } catch (error) {
    console.error(
      `\n❌ Configuration failed: ${error instanceof Error ? error.message : String(error)}`
    );
    console.log("\nTroubleshooting:");
    console.log("- Ensure .env file exists with GITHUB_TOKEN=op://...");
    console.log("- Install 1Password CLI: brew install 1password-cli");
    console.log("- Verify 1Password CLI is authenticated: op account list");
    console.log("- Check 1Password reference is correct: op://Private/GitHub.com/GITHUB_TOKEN");
    process.exit(1);
  }
}

function main(): void {
  const args = process.argv.slice(2);
  const isReauth = args.includes("--reauth");
  const isLocal = args.includes("--local");
  const isGlobal = args.includes("--global");
  const addPatterns = args.includes("--allow-patterns");

  // Handle allow patterns separately
  if (addPatterns) {
    addAllowPatterns();
    return;
  }

  // Determine scope: local if .env exists (org-specific), otherwise global
  let useLocal = existsSync(ENV_FILE);

  // Override with explicit flags
  if (isLocal) useLocal = true;
  if (isGlobal) useLocal = false;

  console.log(`\n📍 Scope: ${useLocal ? "Local (project-specific)" : "Global (user-wide)"}\n`);

  if (useLocal && !existsSync(ENV_FILE)) {
    console.error("❌ Local configuration requires .env file with GITHUB_TOKEN");
    console.log("\nCreate .env file with:");
    console.log("GITHUB_TOKEN=op://Private/GitHub.com/GITHUB_TOKEN");
    process.exit(1);
  }

  if (isReauth) {
    reauthenticate(useLocal);
  } else {
    configure(useLocal);
  }
}

main();
