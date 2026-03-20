import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

// Silence UI output and auto-approve approvals
vi.mock('../ui.js', () => ({
  askApproval: vi.fn().mockResolvedValue('yes'),
  printDiff: vi.fn().mockResolvedValue(undefined),
  printToolCall: vi.fn().mockResolvedValue(undefined),
  printToolResult: vi.fn().mockResolvedValue(undefined),
  printError: vi.fn().mockResolvedValue(undefined),
  printInfo: vi.fn().mockResolvedValue(undefined),
  startSpinner: vi.fn().mockResolvedValue({ stop: vi.fn() }),
}));

const { readFile, writeFile, editFile, listDirectory } = await import('../tools/file.js');

const tmpDir = path.join(os.tmpdir(), `gemini-code-file-test-${process.pid}`);

beforeEach(() => {
  fs.mkdirSync(tmpDir, { recursive: true });
});

function tmpFile(name: string, content: string): string {
  const p = path.join(tmpDir, name);
  fs.writeFileSync(p, content, 'utf-8');
  return p;
}

describe('readFile', () => {
  it('reads file contents', async () => {
    const p = tmpFile('hello.txt', 'hello world');
    const result = await readFile(p);
    expect(result).toBe('hello world');
  });

  it('throws on missing file', async () => {
    await expect(readFile('/nonexistent/file.txt')).rejects.toThrow('Cannot read file');
  });
});

describe('writeFile', () => {
  it('writes file when approved', async () => {
    const p = path.join(tmpDir, 'new.txt');
    await writeFile(p, 'new content');
    expect(fs.readFileSync(p, 'utf-8')).toBe('new content');
  });

  it('declines write when user says no', async () => {
    const { askApproval } = await import('../ui.js');
    vi.mocked(askApproval).mockResolvedValueOnce('no');

    const p = path.join(tmpDir, 'declined.txt');
    const result = await writeFile(p, 'should not write');
    expect(result).toContain('declined');
    expect(fs.existsSync(p)).toBe(false);
  });
});

describe('editFile', () => {
  it('replaces string in file', async () => {
    const p = tmpFile('edit.ts', 'const x = 1;\nconst y = 2;');
    await editFile(p, 'const x = 1;', 'const x = 42;');
    expect(fs.readFileSync(p, 'utf-8')).toBe('const x = 42;\nconst y = 2;');
  });

  it('throws when old_string not found', async () => {
    const p = tmpFile('no-match.ts', 'const x = 1;');
    await expect(editFile(p, 'const z = 9;', 'anything')).rejects.toThrow('String not found');
  });

  it('throws when old_string appears multiple times', async () => {
    const p = tmpFile('multi.ts', 'foo\nfoo\nbar');
    await expect(editFile(p, 'foo', 'baz')).rejects.toThrow('appears 2 times');
  });

  it('throws on missing file', async () => {
    await expect(editFile('/no/file.ts', 'x', 'y')).rejects.toThrow('Cannot read file');
  });
});

describe('listDirectory', () => {
  it('lists directory contents with dirs first', async () => {
    const dir = path.join(tmpDir, 'listtest');
    fs.mkdirSync(path.join(dir, 'subdir'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'file.ts'), '');
    fs.writeFileSync(path.join(dir, 'README.md'), '');

    const result = await listDirectory(dir);
    const lines = result.split('\n');
    expect(lines[0]).toBe('subdir/');
    expect(lines).toContain('file.ts');
    expect(lines).toContain('README.md');
  });

  it('returns empty directory message', async () => {
    const dir = path.join(tmpDir, 'emptydir');
    fs.mkdirSync(dir, { recursive: true });
    const result = await listDirectory(dir);
    expect(result).toBe('(empty directory)');
  });

  it('throws on nonexistent directory', async () => {
    await expect(listDirectory('/no/such/dir')).rejects.toThrow('Cannot list directory');
  });
});
