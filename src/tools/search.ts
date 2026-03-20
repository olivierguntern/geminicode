import { execSync } from 'child_process';
import * as path from 'path';

export async function grepSearch(
  pattern: string,
  searchPath: string,
  fileGlob?: string,
): Promise<string> {
  const abs = path.resolve(searchPath);

  // Build grep command — prefer ripgrep if available, fall back to grep
  let cmd: string;
  try {
    execSync('which rg', { stdio: 'pipe' });
    const globFlag = fileGlob ? `--glob '${fileGlob}'` : '';
    cmd = `rg --line-number --color never ${globFlag} '${pattern.replace(/'/g, "\\'")}' '${abs}'`;
  } catch {
    const nameFlag = fileGlob ? `--include='${fileGlob}'` : '';
    cmd = `grep -rn ${nameFlag} '${pattern.replace(/'/g, "\\'")}' '${abs}'`;
  }

  try {
    const output = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    const lines = output.trim().split('\n');
    if (lines.length > 100) {
      return lines.slice(0, 100).join('\n') + `\n… (${lines.length - 100} more lines, refine your search)`;
    }
    return output.trim() || 'No matches found.';
  } catch (err: unknown) {
    // grep/rg exits with code 1 when no matches found
    if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 1) {
      return 'No matches found.';
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Search failed: ${msg}`);
  }
}

export async function globSearch(pattern: string, cwd: string): Promise<string> {
  const abs = path.resolve(cwd);

  // Use find command with glob-style pattern
  try {
    // Convert glob pattern to find-compatible: replace ** with a recursive find
    const safeCwd = abs.replace(/'/g, "'\\''");
    const safePattern = pattern.replace(/\*\*/g, '*').replace(/'/g, "'\\''");
    const cmd = `find '${safeCwd}' -path '${safePattern}' -not -path '*/node_modules/*' -not -path '*/.git/*' 2>/dev/null | sort | head -200`;
    const output = execSync(cmd, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: '/bin/sh',
    });
    // Make paths relative to cwd
    const lines = output
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((p) => path.relative(abs, p) || p);
    return lines.length > 0 ? lines.join('\n') : 'No files found matching pattern.';
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Glob search failed: ${msg}`);
  }
}
