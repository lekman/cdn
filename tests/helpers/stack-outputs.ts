/**
 * Read Pulumi stack outputs for IQ/OQ qualification tests.
 * Uses STACK env var (default: "dev") to select the target stack.
 */

/** Read a Pulumi stack output by key. Uses the CDN stack by default. */
export async function stackOutput(key: string, stack?: string): Promise<string> {
  const resolvedStack = stack ?? process.env.STACK ?? "dev";
  const proc = Bun.spawn(
    ["pulumi", "stack", "output", key, "--stack", resolvedStack, "--cwd", "infra"],
    {
      stdout: "pipe",
      stderr: "pipe",
    }
  );
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(
      `pulumi stack output ${key} --stack ${resolvedStack} failed (exit ${code}): ${stderr}`
    );
  }
  return stdout.trim();
}
