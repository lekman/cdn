#!/usr/bin/env bun
/**
 * CodeRabbit review findings CLI.
 *
 * Subcommands:
 *   extract [repo-path]                        — Open findings as JSON to stdout
 *   dismiss <comment-id> [repo-path]           — Set resolution "ignore"
 *   resolve <comment-id> [repo-path]           — Set resolution "fixWithAI"
 *   report [repo-path] < triaged.json          — Write .tmp/coderabbit.md
 *   group [--max-groups N] < triaged.json      — Group accepted findings for parallel fix
 *   worktree create <branch> [--context <json>] [repo-path]  — Create isolated worktree
 *   worktree remove <branch> [repo-path]       — Remove worktree and branch
 *   qa-discovery [repo-path]                   — Detect QA commands
 *   open <file> [repo-path]                    — Open file in IDE with markdown preview
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Comment {
  filename: string;
  startLine: number;
  endLine: number;
  type: string;
  comment: string;
  severity: string;
  resolution?: string;
  codegenInstructions?: string;
  indicatorTypes?: string[];
  id?: string;
}

interface FileReview {
  comments: Comment[];
}

interface Review {
  id: string;
  status: string;
  startedAt: string;
  endedAt?: string;
  title?: string;
  mode?: string;
  fileReviewMap: Record<string, FileReview>;
}

export interface Finding {
  commentId: string;
  reviewId: string;
  reviewTitle: string;
  reviewDate: string;
  filename: string;
  startLine: number;
  endLine: number;
  severity: string;
  comment: string;
  codegenInstructions?: string;
  /** Set by AI triage: "accepted" | "outdated" | "rejected" */
  action?: string;
  /** AI triage reason */
  reason?: string;
}

// ---------------------------------------------------------------------------
// VS Code workspace storage discovery
// ---------------------------------------------------------------------------

const VSCODE_VARIANTS = [
  join(
    homedir(),
    "Library",
    "Application Support",
    "Code - Insiders",
    "User",
    "workspaceStorage",
  ),
  join(
    homedir(),
    "Library",
    "Application Support",
    "Code",
    "User",
    "workspaceStorage",
  ),
  join(
    homedir(),
    "Library",
    "Application Support",
    "Cursor",
    "User",
    "workspaceStorage",
  ),
  // Linux
  join(
    homedir(),
    ".config",
    "Code - Insiders",
    "User",
    "workspaceStorage",
  ),
  join(homedir(), ".config", "Code", "User", "workspaceStorage"),
];

interface WorkspaceMatch {
  crDir: string;
  /** Full path to the JSON file containing review arrays */
  reviewFiles: string[];
}

function findWorkspace(repoPath: string): WorkspaceMatch | null {
  const targetUri = `file://${repoPath}`;

  for (const storageRoot of VSCODE_VARIANTS) {
    if (!existsSync(storageRoot)) continue;

    for (const hash of readdirSync(storageRoot)) {
      const wsFile = join(storageRoot, hash, "workspace.json");
      if (!existsSync(wsFile)) continue;

      try {
        const ws = JSON.parse(readFileSync(wsFile, "utf-8"));
        if (ws.folder === targetUri) {
          const crDir = join(
            storageRoot,
            hash,
            "coderabbit.coderabbit-vscode",
          );
          if (!existsSync(crDir)) continue;

          // Find JSON files that contain review arrays
          const reviewFiles: string[] = [];
          for (const file of readdirSync(crDir)) {
            if (!file.endsWith(".json") || file === "categories.json") continue;
            const path = join(crDir, file);
            try {
              const data = JSON.parse(readFileSync(path, "utf-8"));
              if (
                Array.isArray(data) &&
                data.some((d) => d.fileReviewMap && d.id)
              ) {
                reviewFiles.push(path);
              }
            } catch {
              // skip
            }
          }

          if (reviewFiles.length > 0) return { crDir, reviewFiles };
        }
      } catch {
        // skip malformed workspace.json
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Extract open findings (no "ignore" resolution)
// ---------------------------------------------------------------------------

function extractFindings(repoPath: string): Finding[] {
  const ws = findWorkspace(repoPath);
  if (!ws) return [];

  const findings: Finding[] = [];

  for (const reviewFile of ws.reviewFiles) {
    const reviews: Review[] = JSON.parse(readFileSync(reviewFile, "utf-8"));

    for (const review of reviews) {
      if (review.status !== "completed") continue;

      for (const [filename, fileReview] of Object.entries(
        review.fileReviewMap,
      )) {
        for (const comment of fileReview.comments) {
          // Skip closed findings (dismissed or resolved)
          if (
            comment.resolution === "ignore" ||
            comment.resolution === "fixWithAI"
          )
            continue;

          findings.push({
            commentId: comment.id ?? "",
            reviewId: review.id,
            reviewTitle: review.title ?? "Untitled review",
            reviewDate: review.startedAt.split("T")[0],
            filename,
            startLine: comment.startLine,
            endLine: comment.endLine,
            severity: comment.severity ?? "info",
            comment: comment.comment,
            codegenInstructions: comment.codegenInstructions,
          });
        }
      }
    }
  }

  // Sort by severity
  const order: Record<string, number> = {
    critical: 0,
    major: 1,
    minor: 2,
    info: 3,
  };
  findings.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));

  return findings;
}

// ---------------------------------------------------------------------------
// Set resolution on a comment ("ignore" = dismissed, "fixWithAI" = resolved)
// ---------------------------------------------------------------------------

function setResolution(
  repoPath: string,
  commentId: string,
  resolution: string,
): boolean {
  const ws = findWorkspace(repoPath);
  if (!ws) return false;

  for (const reviewFile of ws.reviewFiles) {
    const reviews: Review[] = JSON.parse(readFileSync(reviewFile, "utf-8"));
    let modified = false;

    for (const review of reviews) {
      for (const fileReview of Object.values(review.fileReviewMap)) {
        for (const comment of fileReview.comments) {
          if (comment.id === commentId && comment.resolution !== resolution) {
            comment.resolution = resolution;
            modified = true;
          }
        }
      }
    }

    if (modified) {
      writeFileSync(reviewFile, JSON.stringify(reviews), "utf-8");
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Group accepted findings by file for parallel fix work
// ---------------------------------------------------------------------------

interface FindingGroup {
  groupId: number;
  files: string[];
  findings: Finding[];
}

function groupFindings(findings: Finding[], maxGroups: number): FindingGroup[] {
  const accepted = findings.filter((f) => f.action === "accepted");
  if (accepted.length === 0) return [];

  // Group by filename
  const byFile = new Map<string, Finding[]>();
  for (const f of accepted) {
    const list = byFile.get(f.filename) ?? [];
    list.push(f);
    byFile.set(f.filename, list);
  }

  // Start with one group per file, sorted by count descending
  let groups: { files: string[]; findings: Finding[] }[] = [...byFile.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([file, findings]) => ({ files: [file], findings }));

  // Merge smallest groups until within limit
  while (groups.length > maxGroups) {
    groups.sort((a, b) => b.findings.length - a.findings.length);
    const smallest = groups.pop()!;
    const secondSmallest = groups.pop()!;
    groups.push({
      files: [...secondSmallest.files, ...smallest.files],
      findings: [...secondSmallest.findings, ...smallest.findings],
    });
  }

  return groups.map((g, i) => ({ groupId: i + 1, ...g }));
}

// ---------------------------------------------------------------------------
// Generate markdown report from triaged findings
// ---------------------------------------------------------------------------

function generateReport(repoPath: string, findings: Finding[]): string {
  const repoName = basename(repoPath);

  const accepted = findings.filter((f) => f.action === "accepted");
  const outdated = findings.filter((f) => f.action === "outdated");
  const rejected = findings.filter((f) => f.action === "rejected");

  let md = `# CodeRabbit Findings: ${repoName}\n\n`;
  md += `Generated: ${new Date().toISOString().split("T")[0]}\n\n`;

  // Triage summary — one row per finding
  md += "## Triage Summary\n\n";
  md += "| Issue | Status | Severity |\n";
  md += "|-------|--------|----------|\n";
  for (const f of findings) {
    const title = f.comment
      .split("\n")[0]
      .replace(/\*\*/g, "")
      .replace(/\|/g, "/")
      .slice(0, 80);
    const status =
      f.action === "accepted"
        ? "Accepted"
        : f.action === "outdated"
          ? "Outdated (dismissed)"
          : "Rejected (dismissed)";
    md += `| ${title} | ${status} | ${f.severity} |\n`;
  }
  md += `| **Total** | **${findings.length} reviewed** | |\n\n`;

  if (accepted.length === 0) {
    md += "All findings were either outdated or rejected. No action needed.\n";
    return md;
  }

  // Severity breakdown of accepted
  const sevCounts: Record<string, number> = {};
  for (const f of accepted) {
    sevCounts[f.severity] = (sevCounts[f.severity] ?? 0) + 1;
  }

  md += "## Severity\n\n";
  md += "| Severity | Count |\n";
  md += "|----------|-------|\n";
  for (const sev of ["critical", "major", "minor", "info"]) {
    if (sevCounts[sev]) md += `| ${sev} | ${sevCounts[sev]} |\n`;
  }
  md += "\n";

  // Overview table
  md += "## Findings\n\n";
  md += "| # | Severity | File | Lines | Description |\n";
  md += "|---|----------|------|-------|-------------|\n";

  for (let i = 0; i < accepted.length; i++) {
    const f = accepted[i];
    const num = i + 1;
    const anchor = `finding-${num}`;
    const desc = f.comment
      .split("\n")[0]
      .replace(/\*\*/g, "")
      .replace(/\|/g, "/")
      .slice(0, 80);
    const lines =
      f.startLine === f.endLine
        ? `${f.startLine}`
        : `${f.startLine}-${f.endLine}`;
    md += `| [${num}](#${anchor}) | ${f.severity} | ${f.filename} | ${lines} | ${desc} |\n`;
  }

  md += "\n---\n\n";

  // Detail sections
  for (let i = 0; i < accepted.length; i++) {
    const f = accepted[i];
    const num = i + 1;
    const lines =
      f.startLine === f.endLine
        ? `L${f.startLine}`
        : `L${f.startLine}-${f.endLine}`;

    md += `### <a id="finding-${num}"></a>${num}. [${f.severity}] ${f.filename}:${lines}\n\n`;
    md += `**Review:** ${f.reviewTitle} (${f.reviewDate})\n\n`;
    md += `${f.comment}\n\n`;

    if (f.codegenInstructions) {
      md += `**Fix instructions:**\n\n${f.codegenInstructions}\n\n`;
    }

    md += "---\n\n";
  }

  // Fix Plan section — show file groups for parallel work
  const groups = groupFindings(findings, 5);
  if (groups.length > 0) {
    md += "## Fix Plan\n\n";
    md += `${groups.length} parallel work group(s):\n\n`;
    for (const g of groups) {
      md += `### Group ${g.groupId} (${g.findings.length} finding(s))\n\n`;
      md += "Files:\n";
      for (const file of g.files) {
        md += `- ${file}\n`;
      }
      md += "\n";
    }
  }

  return md;
}

// ---------------------------------------------------------------------------
// Worktree management
// ---------------------------------------------------------------------------

function worktreeBasePath(repoPath: string): string {
  return join(dirname(repoPath), ".worktrees");
}

function worktreePath(repoPath: string, branch: string): string {
  const repoName = basename(repoPath);
  return join(worktreeBasePath(repoPath), `${repoName}-${branch}`);
}

function worktreeCreate(
  repoPath: string,
  branch: string,
  contextFile?: string,
): string {
  const wtPath = worktreePath(repoPath, branch);
  mkdirSync(worktreeBasePath(repoPath), { recursive: true });

  execSync(`git worktree add "${wtPath}" -b "${branch}"`, {
    cwd: repoPath,
    stdio: "pipe",
  });

  // Remove skill/command/settings files to prevent recursive invocation
  for (const sub of [
    join(wtPath, ".claude", "skills"),
    join(wtPath, ".claude", "commands"),
  ]) {
    if (existsSync(sub)) rmSync(sub, { recursive: true, force: true });
  }
  const localSettings = join(wtPath, ".claude", "settings.local.json");
  if (existsSync(localSettings)) rmSync(localSettings, { force: true });

  // Install dependencies
  try {
    execSync("bun install --frozen-lockfile", {
      cwd: wtPath,
      stdio: "pipe",
    });
  } catch {
    // bun may not be available — subagent can install it
  }

  // Copy context file if provided
  if (contextFile && existsSync(contextFile)) {
    const contextDir = join(wtPath, ".tmp");
    mkdirSync(contextDir, { recursive: true });
    const content = readFileSync(contextFile, "utf-8");
    writeFileSync(
      join(contextDir, "coderabbit-fix-context.json"),
      content,
      "utf-8",
    );
  }

  return wtPath;
}

function worktreeRemove(repoPath: string, branch: string): void {
  const wtPath = worktreePath(repoPath, branch);
  execSync(`git worktree remove "${wtPath}" --force`, {
    cwd: repoPath,
    stdio: "pipe",
  });
  try {
    execSync(`git branch -D "${branch}"`, { cwd: repoPath, stdio: "pipe" });
  } catch {
    // branch may already be gone
  }
}

// ---------------------------------------------------------------------------
// QA discovery — detect available quality commands
// ---------------------------------------------------------------------------

interface QADiscovery {
  qaFile?: string;
  qualityCommand?: string;
  testCommand?: string;
  lintCommand?: string;
  securityCommand?: string;
  securityDoc?: string;
}

function discoverQA(repoPath: string): QADiscovery {
  const result: QADiscovery = {};

  if (existsSync(join(repoPath, "docs", "QA.md"))) {
    result.qaFile = "docs/QA.md";
  }

  const hasTaskfile = existsSync(join(repoPath, "Taskfile.yml"));
  const hasPkg = existsSync(join(repoPath, "package.json"));

  if (hasTaskfile) {
    result.qualityCommand = "task quality";
    result.testCommand = "task test";
    result.lintCommand = "task lint";
    result.securityCommand = "task security:scan";
  } else if (hasPkg) {
    result.qualityCommand = "bun run lint && bun test";
    result.testCommand = "bun test";
    result.lintCommand = "bun run lint";
  }

  if (existsSync(join(repoPath, "docs", "SECURITY.md"))) {
    result.securityDoc = "docs/SECURITY.md";
  }

  return result;
}

// ---------------------------------------------------------------------------
// Open file in IDE with markdown preview
// ---------------------------------------------------------------------------

const IDE_PROCESS_NAMES: Record<string, string> = {
  "Code - Insiders": "code-insiders",
  Cursor: "cursor",
  Code: "code",
};

const IDE_CLI_PATHS = [
  "/usr/local/bin/code-insiders",
  "/usr/local/bin/cursor",
  "/usr/local/bin/code",
];

function detectIDE(): string | null {
  // Check running processes for IDE preference
  try {
    const ps = execSync("ps -eo comm", { stdio: "pipe" }).toString();
    for (const [procName, cli] of Object.entries(IDE_PROCESS_NAMES)) {
      if (ps.includes(procName)) {
        const cliPath = `/usr/local/bin/${cli}`;
        if (existsSync(cliPath)) return cliPath;
      }
    }
  } catch {
    // fall through to CLI detection
  }

  // Fall back to first available CLI
  for (const cliPath of IDE_CLI_PATHS) {
    if (existsSync(cliPath)) return cliPath;
  }

  return null;
}

function openInIDE(filePath: string): void {
  const ide = detectIDE();
  if (ide) {
    execSync(`"${ide}" --reuse-window "${filePath}"`, { stdio: "pipe" });
    // Brief pause then trigger markdown preview
    Bun.sleepSync(500);
    execSync(`"${ide}" --command markdown.showPreview`, { stdio: "pipe" });
  } else {
    execSync(`open "${filePath}"`, { stdio: "pipe" });
  }
}

// ---------------------------------------------------------------------------
// CLI — argument parsing
// ---------------------------------------------------------------------------

function parseArgs(): {
  command: string;
  subcommand?: string;
  repoPath: string;
  args: string[];
} {
  const argv = process.argv.slice(2);
  const command = argv[0] ?? "extract";

  // "worktree create" and "worktree remove" are two-word commands
  if (command === "worktree" && argv[1]) {
    return {
      command: "worktree",
      subcommand: argv[1],
      repoPath: process.cwd(),
      args: argv.slice(2),
    };
  }

  // Commands that take <id> as first positional arg
  if (command === "dismiss" || command === "resolve") {
    return {
      command,
      repoPath: argv[2] ?? process.cwd(),
      args: argv.slice(1),
    };
  }

  // "open <file> [repo-path]"
  if (command === "open") {
    return {
      command,
      repoPath: argv[2] ?? process.cwd(),
      args: argv.slice(1),
    };
  }

  return {
    command,
    repoPath: argv[1] ?? process.cwd(),
    args: argv.slice(1),
  };
}

const parsed = parseArgs();

switch (parsed.command) {
  case "extract": {
    const findings = extractFindings(parsed.repoPath);
    console.log(
      findings.length === 0 ? "[]" : JSON.stringify(findings, null, 2),
    );
    break;
  }

  case "dismiss": {
    const commentId = parsed.args[0];
    if (!commentId) {
      console.error("Usage: bun coderabbit-report.ts dismiss <comment-id>");
      process.exit(1);
    }
    const ok = setResolution(parsed.repoPath, commentId, "ignore");
    console.log(ok ? "dismissed" : "not found");
    break;
  }

  case "resolve": {
    const commentId = parsed.args[0];
    if (!commentId) {
      console.error("Usage: bun coderabbit-report.ts resolve <comment-id>");
      process.exit(1);
    }
    const ok = setResolution(parsed.repoPath, commentId, "fixWithAI");
    console.log(ok ? "resolved" : "not found");
    break;
  }

  case "report": {
    const input = readFileSync("/dev/stdin", "utf-8");
    const findings: Finding[] = JSON.parse(input);
    const md = generateReport(parsed.repoPath, findings);

    const outDir = join(parsed.repoPath, ".tmp");
    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, "coderabbit.md");
    writeFileSync(outPath, md, "utf-8");
    console.log(outPath);
    break;
  }

  case "group": {
    let maxGroups = 5;
    const maxIdx = parsed.args.indexOf("--max-groups");
    if (maxIdx !== -1 && parsed.args[maxIdx + 1]) {
      maxGroups = Number.parseInt(parsed.args[maxIdx + 1], 10);
    }
    const input = readFileSync("/dev/stdin", "utf-8");
    const findings: Finding[] = JSON.parse(input);
    const groups = groupFindings(findings, maxGroups);
    console.log(JSON.stringify(groups, null, 2));
    break;
  }

  case "worktree": {
    if (parsed.subcommand === "create") {
      const branch = parsed.args[0];
      if (!branch) {
        console.error(
          "Usage: bun coderabbit-report.ts worktree create <branch>",
        );
        process.exit(1);
      }
      let contextFile: string | undefined;
      const ctxIdx = parsed.args.indexOf("--context");
      if (ctxIdx !== -1 && parsed.args[ctxIdx + 1]) {
        contextFile = parsed.args[ctxIdx + 1];
      }
      // Repo path: last positional that isn't a flag value
      const repoPath = (() => {
        for (let i = parsed.args.length - 1; i >= 1; i--) {
          if (
            parsed.args[i - 1] !== "--context" &&
            !parsed.args[i].startsWith("--")
          ) {
            return parsed.args[i];
          }
        }
        return process.cwd();
      })();
      const wtPath = worktreeCreate(repoPath, branch, contextFile);
      console.log(wtPath);
    } else if (parsed.subcommand === "remove") {
      const branch = parsed.args[0];
      if (!branch) {
        console.error(
          "Usage: bun coderabbit-report.ts worktree remove <branch>",
        );
        process.exit(1);
      }
      const repoPath = parsed.args[1] ?? process.cwd();
      worktreeRemove(repoPath, branch);
      console.log("removed");
    } else {
      console.error(
        "Usage: bun coderabbit-report.ts worktree <create|remove> ...",
      );
      process.exit(1);
    }
    break;
  }

  case "qa-discovery": {
    const result = discoverQA(parsed.repoPath);
    console.log(JSON.stringify(result, null, 2));
    break;
  }

  case "open": {
    const file = parsed.args[0];
    if (!file) {
      console.error("Usage: bun coderabbit-report.ts open <file>");
      process.exit(1);
    }
    const fullPath = resolve(parsed.repoPath, file);
    openInIDE(fullPath);
    console.log(`opened ${fullPath}`);
    break;
  }

  default:
    console.error(`Unknown command: ${parsed.command}`);
    console.error(
      "Commands: extract, dismiss, resolve, report, group, worktree, qa-discovery, open",
    );
    process.exit(1);
}
