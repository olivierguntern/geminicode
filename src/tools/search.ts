import { execFileSync, execSync } from 'child_process';
import * as path from 'path';

export async function grepSearch(
  pattern: string,
  searchPath: string,
  fileGlob?: string,
): Promise<string> {
  const abs = path.resolve(searchPath);

  // Use execFileSync with array args — no shell injection possible
  let output: string;
  try {
    execSync('which rg', { stdio: 'pipe' });
    // ripgrep available
    const args = ['--line-number', '--color', 'never'];
    if (fileGlob) args.push('--glob', fileGlob);
    args.push(pattern, abs);
    output = execFileSync('rg', args, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (rgErr: unknown) {
    // rg not found OR rg returned exit code 1 (no matches)
    const status = (rgErr as { status?: number }).status;
    if (status === 1) {
      return 'No matches found.';
    }
    if (status !== undefined && status > 1) {
      const msg = rgErr instanceof Error ? rgErr.message : String(rgErr);
      throw new Error(`Search failed: ${msg}`);
    }

    // rg not found — fall back to grep
    try {
      const args = ['-rn'];
      if (fileGlob) args.push(`--include=${fileGlob}`);
      args.push(pattern, abs);
      output = execFileSync('grep', args, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (grepErr: unknown) {
      const status2 = (grepErr as { status?: number }).status;
      if (status2 === 1) return 'No matches found.';
      const msg = grepErr instanceof Error ? grepErr.message : String(grepErr);
      throw new Error(`Search failed: ${msg}`);
    }
  }

  const lines = output.trim().split('\n').filter(Boolean);
  if (lines.length > 100) {
    return lines.slice(0, 100).join('\n') + `\n… (${lines.length - 100} more lines, refine your search)`;
  }
  return output.trim() || 'No matches found.';
}

export async function globSearch(pattern: string, cwd: string): Promise<string> {
  const abs = path.resolve(cwd);

  // Use find with -name or -path depending on whether pattern contains /
  // We use execFileSync args array to avoid injection
  try {
    const hasPath = pattern.includes('/');
    // Build find args safely
    const findArgs = [abs, '-not', '-path', '*/node_modules/*', '-not', '-path', '*/.git/*'];

    if (hasPath) {
      // -path with wildcard prefix for depth-independent matching
      const normalizedPattern = pattern.startsWith('**/') ? `*/${pattern.slice(3)}` : pattern;
      findArgs.push('-path', `*/${normalizedPattern}`);
    } else {
      findArgs.push('-name', pattern);
    }

    findArgs.push('-type', 'f');

    const output = execFileSync('find', findArgs, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const lines = output
      .trim()
      .split('\n')
      .filter(Boolean)
      .slice(0, 200)
      .map((p) => path.relative(abs, p) || p)
      .sort();

    return lines.length > 0 ? lines.join('\n') : 'No files found matching pattern.';
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Glob search failed: ${msg}`);
  }
}
