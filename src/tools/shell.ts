import { execSync } from 'child_process';
import { askApproval, printToolCall } from '../ui.js';

export async function bashCommand(command: string, cwd: string): Promise<string> {
  await printToolCall('bash_command', { command });

  const decision = await askApproval(`Run command: "${command}"?`);
  if (decision === 'quit') process.exit(0);
  if (decision === 'no') return `User declined to run command: "${command}".`;

  try {
    const output = execSync(command, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000,
    });
    return output || '(command completed with no output)';
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'stdout' in err && 'stderr' in err) {
      const e = err as { stdout: string; stderr: string; status: number };
      const combined = [e.stdout, e.stderr].filter(Boolean).join('\n');
      return `Command failed (exit ${e.status}):\n${combined}`;
    }
    const msg = err instanceof Error ? err.message : String(err);
    return `Command failed: ${msg}`;
  }
}
