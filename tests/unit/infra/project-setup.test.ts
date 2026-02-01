/**
 * Unit: Pulumi project configuration tests.
 * Validates the Pulumi project with TypeScript runtime
 * and per-environment stack configs.
 */

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const INFRA_ROOT = join(import.meta.dir, "../../../infra");

function parsePulumiYaml(filePath: string): Record<string, string> {
  const content = readFileSync(filePath, "utf-8");
  const result: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match?.[1] && match[2]) {
      result[match[1]] = match[2].trim();
    }
  }
  return result;
}

describe("Unit: Pulumi project structure", () => {
  test("infra/ directory exists", () => {
    expect(existsSync(INFRA_ROOT)).toBe(true);
  });

  test("infra/tsconfig.json exists with strict mode", () => {
    const tsconfigPath = join(INFRA_ROOT, "tsconfig.json");
    expect(existsSync(tsconfigPath)).toBe(true);

    const tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf-8"));
    expect(tsconfig.compilerOptions.strict).toBe(true);
  });

  test("infra/package.json exists with Pulumi dependencies", () => {
    const pkgPath = join(INFRA_ROOT, "package.json");
    expect(existsSync(pkgPath)).toBe(true);

    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
    expect(pkg.dependencies).toBeDefined();
    expect(pkg.dependencies["@pulumi/pulumi"]).toBeDefined();
    expect(pkg.dependencies["@pulumi/azure-native"]).toBeDefined();
  });

  test("Pulumi.yaml exists with nodejs runtime", () => {
    const pulumiYaml = join(INFRA_ROOT, "Pulumi.yaml");
    expect(existsSync(pulumiYaml)).toBe(true);

    const config = parsePulumiYaml(pulumiYaml);
    expect(config.runtime).toBe("nodejs");
    expect(config.name).toBe("cdn-infra");
  });

  test("infra/index.ts entry point exists", () => {
    expect(existsSync(join(INFRA_ROOT, "index.ts"))).toBe(true);
  });

  test("infra/stack.ts environment bridge exists", () => {
    expect(existsSync(join(INFRA_ROOT, "stack.ts"))).toBe(true);
  });

  test("infra/specification.ts exists", () => {
    expect(existsSync(join(INFRA_ROOT, "specification.ts"))).toBe(true);
  });

  test("infra/cdn/ module directory exists", () => {
    expect(existsSync(join(INFRA_ROOT, "cdn"))).toBe(true);
  });

  test("infra/cdn/configs.ts exists", () => {
    expect(existsSync(join(INFRA_ROOT, "cdn", "configs.ts"))).toBe(true);
  });
});

describe("Unit: per-environment stack configs", () => {
  test("Pulumi.dev.yaml exists", () => {
    expect(existsSync(join(INFRA_ROOT, "Pulumi.dev.yaml"))).toBe(true);
  });

  test("Pulumi.prod.yaml exists", () => {
    expect(existsSync(join(INFRA_ROOT, "Pulumi.prod.yaml"))).toBe(true);
  });
});
