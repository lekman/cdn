#!/usr/bin/env bun
/**
 * Bootstrap consumption plan Function App on MSDN subscription.
 * Creates the Function App via Azure CLI and imports it into Pulumi state.
 *
 * Usage: bun scripts/infra-bootstrap.ts [stack]
 *   stack defaults to "dev"
 */

import { join } from "node:path";
import {
  section, ok, fatal,
  check, run, tryRun, exec,
  GREEN, YELLOW, CYAN, NC,
} from "./lib.ts";

const STACK = process.argv[2] || "dev";
const INFRA_DIR = join(import.meta.dir, "..", "infra");

section(`Bootstrapping Function App + consumption plan for ${GREEN}${STACK}${NC}`);
console.log(`${YELLOW}Required on MSDN subscriptions where ARM API cannot create App Service Plans${NC}`);
console.log("");

// --- Read spec values from Pulumi ---

let rg = tryRun("pulumi", ["config", "get", "--stack", STACK, "--path", "cdn:resourceGroupName"], { cwd: INFRA_DIR });
if (!rg) {
  rg = tryRun("pulumi", ["stack", "output", "--stack", STACK, "resourceGroupName"], { cwd: INFRA_DIR });
}
if (!rg) {
  fatal(`Cannot determine resource group name. Run 'task infra:up -- ${STACK}' first to create the resource group.`);
}

const sa = tryRun("pulumi", ["stack", "output", "--stack", STACK, "storageAccountName"], { cwd: INFRA_DIR });
if (!sa) {
  fatal(`Storage account not found in stack outputs. Run 'task infra:up -- ${STACK}' first to create base resources.`);
}

const func = tryRun("pulumi", ["stack", "output", "--stack", STACK, "functionAppName"], { cwd: INFRA_DIR });
if (!func) {
  fatal("Function app name not found in stack outputs.");
}

// --- Check if function app already exists ---

if (check("az", ["functionapp", "show", "--name", func, "--resource-group", rg])) {
  ok(`Function app ${func} already exists`);
  console.log("");

  // Check if already imported into Pulumi state
  const stateJson = tryRun("pulumi", ["stack", "--stack", STACK, "export"], { cwd: INFRA_DIR });
  let imported = false;
  if (stateJson) {
    try {
      const state = JSON.parse(stateJson);
      const resources: Array<{ type?: string }> = state?.deployment?.resources ?? [];
      imported = resources.some((r) => (r.type ?? "").includes("WebApp"));
    } catch {
      // JSON parse failed — assume not imported
    }
  }

  if (imported) {
    ok("Already imported into Pulumi state");
  } else {
    console.log(`${CYAN}Importing into Pulumi state...${NC}`);
    const subId = run("az", ["account", "show", "--query", "id", "-o", "tsv"]);
    const importId = `/subscriptions/${subId}/resourceGroups/${rg}/providers/Microsoft.Web/sites/${func}`;
    exec("pulumi", ["import", "--stack", STACK, "--yes", "azure-native:web:WebApp", "func", importId], { cwd: INFRA_DIR });
    ok("Imported into Pulumi state");
  }

  process.exit(0);
}

// --- Create function app ---

console.log(`${CYAN}Creating function app via Azure CLI...${NC}`);
exec("az", [
  "functionapp", "create",
  "--name", func,
  "--resource-group", rg,
  "--storage-account", sa,
  "--consumption-plan-location", "uksouth",
  "--runtime", "node", "--runtime-version", "20",
  "--functions-version", "4", "--os-type", "Linux",
  "--assign-identity", "[system]",
  "--query", "{name:name, plan:serverFarmId}", "-o", "json",
]);

console.log("");
console.log(`${CYAN}Importing into Pulumi state...${NC}`);
const subId = run("az", ["account", "show", "--query", "id", "-o", "tsv"]);
const importId = `/subscriptions/${subId}/resourceGroups/${rg}/providers/Microsoft.Web/sites/${func}`;
exec("pulumi", ["import", "--stack", STACK, "--yes", "azure-native:web:WebApp", "func", importId], { cwd: INFRA_DIR });

console.log("");
ok("Bootstrap complete");
console.log(`  Function app: ${func}`);
console.log(`  Next step: ${CYAN}task infra:up -- ${STACK}${NC}`);
