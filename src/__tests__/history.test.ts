import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import type { Content } from '@google/genai';

// Use a temp directory for history storage during tests
const tmpDir = path.join(os.tmpdir(), `gemini-code-test-${process.pid}`);

vi.mock('os', async (importOriginal) => {
  const orig = await importOriginal<typeof os>();
  return {
    ...orig,
    homedir: () => tmpDir,
  };
});

// Import after mock is set up
const { loadHistory, saveHistory, clearSavedHistory } = await import('../history.js');

const testCwd = '/test/project/dir';

function makeTurn(role: 'user' | 'model', text: string): Content {
  return { role, parts: [{ text }] };
}

describe('persistent history', () => {
  beforeEach(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns empty array when no history file exists', () => {
    const result = loadHistory(testCwd);
    expect(result).toEqual([]);
  });

  it('saves and loads history correctly', () => {
    const history: Content[] = [
      makeTurn('user', 'Hello'),
      makeTurn('model', 'Hi there!'),
    ];
    saveHistory(testCwd, history);
    const loaded = loadHistory(testCwd);
    expect(loaded).toEqual(history);
  });

  it('clears saved history', () => {
    const history: Content[] = [makeTurn('user', 'test')];
    saveHistory(testCwd, history);
    clearSavedHistory(testCwd);
    const loaded = loadHistory(testCwd);
    expect(loaded).toEqual([]);
  });

  it('clearSavedHistory does not throw when no file exists', () => {
    expect(() => clearSavedHistory('/nonexistent/path')).not.toThrow();
  });

  it('isolates history by cwd', () => {
    const historyA: Content[] = [makeTurn('user', 'project A message')];
    const historyB: Content[] = [makeTurn('user', 'project B message')];

    saveHistory('/project/a', historyA);
    saveHistory('/project/b', historyB);

    expect(loadHistory('/project/a')).toEqual(historyA);
    expect(loadHistory('/project/b')).toEqual(historyB);
  });
});
