import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import type { Content } from '@google/genai';

function getHistoryDir(): string {
  return path.join(os.homedir(), '.gemini-code', 'sessions');
}

function getHistoryPath(cwd: string): string {
  const hash = Buffer.from(cwd).toString('base64url').slice(0, 20);
  const dir = getHistoryDir();
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${hash}.json`);
}

/** Load persisted conversation history for the given working directory. */
export function loadHistory(cwd: string): Content[] {
  const filePath = getHistoryPath(cwd);
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(data);
    if (Array.isArray(parsed)) return parsed as Content[];
    return [];
  } catch {
    return [];
  }
}

/** Persist conversation history to disk. */
export function saveHistory(cwd: string, history: Content[]): void {
  const filePath = getHistoryPath(cwd);
  try {
    fs.writeFileSync(filePath, JSON.stringify(history), 'utf-8');
  } catch {
    // History is a convenience feature — ignore write errors silently
  }
}

/** Delete the persisted history file for the given working directory. */
export function clearSavedHistory(cwd: string): void {
  const filePath = getHistoryPath(cwd);
  try {
    fs.unlinkSync(filePath);
  } catch {
    // File may not exist — that's fine
  }
}
