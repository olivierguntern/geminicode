import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

// Mock child_process to control search results without real rg/grep/find
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  execFileSync: vi.fn(),
}));

const { execSync, execFileSync } = await import('child_process');
const { grepSearch, globSearch } = await import('../tools/search.js');

const tmpDir = path.join(os.tmpdir(), `gemini-code-search-test-${process.pid}`);

beforeEach(() => {
  fs.mkdirSync(tmpDir, { recursive: true });
  vi.resetAllMocks();
});

describe('grepSearch', () => {
  it('returns matches from ripgrep', async () => {
    // execSync('which rg') succeeds — rg is available
    vi.mocked(execSync).mockReturnValue(Buffer.from('/usr/bin/rg'));
    vi.mocked(execFileSync).mockReturnValue('src/foo.ts:10:const x = 1;\nsrc/bar.ts:5:const x = 2;');

    const result = await grepSearch('const x', tmpDir);
    expect(result).toContain('src/foo.ts:10');
    expect(result).toContain('src/bar.ts:5');
  });

  it('returns "No matches found." when rg exits with status 1', async () => {
    vi.mocked(execSync).mockReturnValue(Buffer.from('/usr/bin/rg'));
    const err = Object.assign(new Error('no matches'), { status: 1 });
    vi.mocked(execFileSync).mockImplementation(() => { throw err; });

    const result = await grepSearch('zzznomatches', tmpDir);
    expect(result).toBe('No matches found.');
  });

  it('falls back to grep when rg is not found', async () => {
    // execSync throws when rg is not found
    vi.mocked(execSync).mockImplementation(() => { throw new Error('not found'); });
    vi.mocked(execFileSync).mockReturnValue('file.ts:3:hello world');

    const result = await grepSearch('hello', tmpDir);
    expect(result).toContain('file.ts:3:hello world');
  });

  it('caps output at 100 lines', async () => {
    vi.mocked(execSync).mockReturnValue(Buffer.from('/usr/bin/rg'));
    const lines = Array.from({ length: 150 }, (_, i) => `file.ts:${i + 1}:match`).join('\n');
    vi.mocked(execFileSync).mockReturnValue(lines);

    const result = await grepSearch('match', tmpDir);
    const resultLines = result.split('\n').filter((l) => !l.startsWith('…'));
    expect(resultLines.length).toBeLessThanOrEqual(100);
    expect(result).toContain('50 more lines');
  });
});

describe('globSearch', () => {
  it('returns matching file paths', async () => {
    vi.mocked(execFileSync).mockReturnValue(
      `${tmpDir}/src/index.ts\n${tmpDir}/src/agent.ts\n`,
    );
    const result = await globSearch('*.ts', tmpDir);
    expect(result).toContain('src/index.ts');
    expect(result).toContain('src/agent.ts');
  });

  it('returns "No files found" when nothing matches', async () => {
    vi.mocked(execFileSync).mockReturnValue('');
    const result = await globSearch('*.nonexistent', tmpDir);
    expect(result).toBe('No files found matching pattern.');
  });

  it('caps output at 200 files', async () => {
    const files = Array.from({ length: 300 }, (_, i) => `${tmpDir}/file${i}.ts`).join('\n');
    vi.mocked(execFileSync).mockReturnValue(files);
    const result = await globSearch('*.ts', tmpDir);
    const count = result.split('\n').length;
    expect(count).toBeLessThanOrEqual(200);
  });
});
