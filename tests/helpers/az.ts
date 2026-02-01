/**
 * Shared az CLI helper for IQ/OQ qualification tests.
 * Runs Azure CLI commands and parses JSON output.
 */

/** Run az CLI command and parse JSON output. */
export async function az<T>(args: string): Promise<T> {
  const proc = Bun.spawn(["az", ...args.split(" ")], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`az ${args} failed (exit ${code}): ${stderr}`);
  }
  return JSON.parse(stdout) as T;
}
