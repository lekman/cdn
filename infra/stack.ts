/**
 * Bridges Pulumi stack name to infrastructure specification.
 * Resource files import `spec` from this module at runtime.
 */

import * as pulumi from "@pulumi/pulumi";
import { createSpec, Environment } from "./specification";

const validEnvs = new Set<string>(["dev", "prod"]);
const stackName = pulumi.getStack();

if (!validEnvs.has(stackName)) {
  throw new Error(`Pulumi stack name must be "dev" or "prod", got "${stackName}"`);
}

export const env: Environment = stackName as Environment;
export const spec = createSpec(env);
