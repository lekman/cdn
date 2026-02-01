#!/usr/bin/env bun
/**
 * Setup Azure OIDC for CI/CD: app registration, federated credentials,
 * role assignments, and GitHub variables.
 *
 * Usage: bun scripts/oidc-setup.ts
 */

import {
  section, ok, fatal, requireCmd,
  check, run, tryRun, exec,
  GREEN, YELLOW, CYAN, NC,
} from "./lib.ts";

const APP_NAME = "github-cdn-ci";
const REPO = "lekman/cdn";

section("OIDC Setup for CI/CD");
console.log("---");

// --- Prerequisites ---

for (const cmd of ["az", "gh"]) {
  requireCmd(cmd);
}

if (!check("az", ["account", "show"])) {
  console.log(`${YELLOW}Not logged in to Azure. Launching login...${NC}`);
  exec("az", ["login"]);
}

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

const subId = run("az", ["account", "show", "--query", "id", "-o", "tsv"]);
const tenantId = run("az", ["account", "show", "--query", "tenantId", "-o", "tsv"]);
console.log(`Subscription: ${GREEN}${subId}${NC}`);
console.log(`Tenant:       ${GREEN}${tenantId}${NC}`);
console.log("");

// --- 1. App registration ---

section("1. App registration");
let appId = tryRun("az", ["ad", "app", "list", "--display-name", APP_NAME, "--query", "[0].appId", "-o", "tsv"]);

if (appId) {
  ok(`${APP_NAME} exists (${appId})`);
} else {
  appId = run("az", ["ad", "app", "create", "--display-name", APP_NAME, "--query", "appId", "-o", "tsv"]);
  ok(`Created ${APP_NAME} (${appId})`);
}

// --- 2. Service principal ---

section("2. Service principal");
const spExists = tryRun("az", ["ad", "sp", "list", "--filter", `appId eq '${appId}'`, "--query", "[0].id", "-o", "tsv"]);

if (spExists) {
  ok("Already exists");
} else {
  run("az", ["ad", "sp", "create", "--id", appId]);
  ok("Created");
}

// --- 3. Federated identity credentials ---

section("3. Federated identity credentials");

function addCredential(name: string, subject: string): void {
  const existing = tryRun("az", [
    "ad", "app", "federated-credential", "list",
    "--id", appId,
    "--query", `[?name=='${name}'].name`,
    "-o", "tsv",
  ]);

  if (existing) {
    ok(`${name} exists`);
    return;
  }

  const params = JSON.stringify({
    name,
    issuer: "https://token.actions.githubusercontent.com",
    subject,
    audiences: ["api://AzureADTokenExchange"],
  });

  run("az", ["ad", "app", "federated-credential", "create", "--id", appId, "--parameters", params]);
  ok(`Created ${name}`);
}

addCredential("github-main", `repo:${REPO}:ref:refs/heads/main`);
addCredential("github-pr", `repo:${REPO}:pull_request`);
addCredential("github-production", `repo:${REPO}:environment:production`);

// --- 4. Role assignments ---

section(`4. Role assignments (Contributor + User Access Administrator on subscription)`);
const scope = `/subscriptions/${subId}`;

for (const role of ["Contributor", "User Access Administrator"]) {
  // az role assignment create is idempotent — succeeds if already exists
  tryRun("az", ["role", "assignment", "create", "--assignee", appId, "--role", role, "--scope", scope]);
  ok(`${role} on subscription ${subId}`);
}

// --- 5. GitHub variables ---

section("5. GitHub variables");

const vars: Record<string, string> = {
  ARM_CLIENT_ID: appId,
  ARM_TENANT_ID: tenantId,
  ARM_SUBSCRIPTION_ID: subId,
};

for (const [name, value] of Object.entries(vars)) {
  run("gh", ["variable", "set", name, "--repo", REPO, "--body", value]);
  ok(name);
}

console.log("");
ok("OIDC setup complete");
console.log(`  App:     ${CYAN}${appId}${NC}`);
console.log(`  Vars:    ARM_CLIENT_ID, ARM_TENANT_ID, ARM_SUBSCRIPTION_ID`);
