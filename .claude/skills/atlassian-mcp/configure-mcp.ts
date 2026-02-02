#!/usr/bin/env bun

/**
 * Configure Atlassian MCP Server
 *
 * Adds the Atlassian MCP server to Claude Code's user-level configuration.
 * Uses OAuth authentication (no tokens needed in .env).
 *
 * Usage:
 *   bun configure-mcp.ts              # Configure server
 *   bun configure-mcp.ts --reauth     # Reauthenticate (clear and reconfigure)
 *
 * Requirements:
 * - Bun runtime
 * - Claude CLI (for MCP management)
 *
 * Configuration scopes:
 * - User scope: ~/.claude.json (this script)
 * - Project scope: .mcp.json (checked into git)
 * - Local scope: ~/.claude.json under project path (private)
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const CLAUDE_CONFIG_FILE = join(homedir(), ".claude.json");

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

function readClaudeConfig(): McpSettings {
  if (!existsSync(CLAUDE_CONFIG_FILE)) {
    console.log("No existing .claude.json found, creating new file");
    return { mcpServers: {} };
  }

  try {
    const content = readFileSync(CLAUDE_CONFIG_FILE, "utf-8");
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
      `Error parsing existing .claude.json: ${error instanceof Error ? error.message : String(error)}`
    );
    console.log("Creating new configuration");
    return { mcpServers: {} };
  }
}

function writeClaudeConfig(settings: McpSettings): void {
  const content = JSON.stringify(settings, null, 2);
  writeFileSync(CLAUDE_CONFIG_FILE, content, "utf-8");
  console.log(`✓ Updated ${CLAUDE_CONFIG_FILE}`);
}

function reauthenticate(): void {
  console.log("Reauthenticating Atlassian MCP Server\n");

  // Remove the MCP server using Claude CLI to clear stored OAuth tokens
  console.log("Removing existing configuration...");
  const removeResult = spawnSync("claude", ["mcp", "remove", "atlassian"], {
    stdio: "inherit",
    shell: true,
  });

  if (removeResult.status !== 0) {
    console.error("⚠ Failed to remove Atlassian MCP server");
    console.log("Continuing with reconfiguration...\n");
  } else {
    console.log("✓ Cleared existing configuration\n");
  }

  // Reconfigure
  configure();
}

function configure(): void {
  console.log("Configuring Atlassian MCP Server for Claude Code\n");

  try {
    const settings = readClaudeConfig();

    // Check if Atlassian MCP is already configured
    if (settings.mcpServers.atlassian) {
      console.log("⚠ Atlassian MCP server already configured");
      console.log("Overwriting with new configuration...\n");
    }

    // Configure Atlassian MCP with OAuth (no token needed)
    const atlassianMcpConfig: McpServerConfig = {
      type: "http",
      url: "https://api.atlassian.com/mcp/",
    };

    settings.mcpServers.atlassian = atlassianMcpConfig;
    writeClaudeConfig(settings);

    console.log("\n✓ Atlassian MCP server configured successfully");
    console.log("\nConfiguration:");
    console.log("  Server: atlassian");
    console.log("  Type: http");
    console.log("  URL: https://api.atlassian.com/mcp/");
    console.log("  Auth: OAuth (interactive)");
    console.log("\nNext steps:");
    console.log("1. Exit Claude Code");
    console.log("2. Run: claude /mcp");
    console.log("3. Select 'atlassian' from the list");
    console.log("4. Press Enter to start OAuth flow");
    console.log("5. Complete authentication in browser");
    console.log("6. Restart Claude Code with: claude -c");
    console.log("\n⚠ NOTE: OAuth tokens are managed by Claude CLI");
  } catch (error) {
    console.error(
      `\n❌ Configuration failed: ${error instanceof Error ? error.message : String(error)}`
    );
    console.log("\nTroubleshooting:");
    console.log("- Ensure Bun is installed: curl -fsSL https://bun.sh/install | bash");
    console.log("- Ensure Claude CLI is installed");
    console.log("- Contact site admin if you see 'admin authorization required' error");
    process.exit(1);
  }
}

function main(): void {
  const args = process.argv.slice(2);
  const isReauth = args.includes("--reauth");

  if (isReauth) {
    reauthenticate();
  } else {
    configure();
  }
}

main();
