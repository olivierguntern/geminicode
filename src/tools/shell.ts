import { spawn } from 'child_process';
import { askApproval, printToolCall } from '../ui.js';

export async function bashCommand(command: string, cwd: string): Promise<string> {
  await printToolCall('bash_command', { command });

  const decision = await askApproval(`Run command: "${command}"?`);
  if (decision === 'quit') process.exit(0);
  if (decision === 'no') return `User declined to run command: "${command}".`;

  return new Promise((resolve) => {
    const child = spawn('sh', ['-c', command], {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let output = '';

    child.stdout.on('data', (data: Buffer) => {
      const text = data.toString();
      process.stdout.write(text);
      output += text;
    });

    child.stderr.on('data', (data: Buffer) => {
      const text = data.toString();
      process.stderr.write(text);
      output += text;
    });

    const timer = setTimeout(() => {
      child.kill();
      resolve(`Command timed out after 30 seconds.\n${output}`);
    }, 30_000);

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        resolve(`Command failed (exit ${code}):\n${output || '(no output)'}`);
      } else {
        resolve(output || '(command completed with no output)');
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      resolve(`Command failed: ${err.message}`);
    });
  });
}
