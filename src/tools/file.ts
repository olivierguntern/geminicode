import * as fs from 'fs/promises';
import * as path from 'path';
import { askApproval, printDiff, printToolCall } from '../ui.js';

export async function readFile(filePath: string): Promise<string> {
  const abs = path.resolve(filePath);
  try {
    const content = await fs.readFile(abs, 'utf-8');
    return content;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Cannot read file "${filePath}": ${msg}`);
  }
}

export async function writeFile(filePath: string, content: string): Promise<string> {
  const abs = path.resolve(filePath);

  // Show diff before writing
  let oldContent = '';
  try {
    oldContent = await fs.readFile(abs, 'utf-8');
  } catch {
    // File doesn't exist yet — treat as new file
  }

  await printToolCall('write_file', { path: filePath });
  await printDiff(oldContent, content, filePath);

  const decision = await askApproval(`Write to "${filePath}"?`);
  if (decision === 'quit') process.exit(0);
  if (decision === 'no') return `User declined to write "${filePath}".`;

  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content, 'utf-8');
  return `File "${filePath}" written successfully (${content.length} chars).`;
}

export async function editFile(
  filePath: string,
  oldString: string,
  newString: string,
): Promise<string> {
  const abs = path.resolve(filePath);
  let content: string;
  try {
    content = await fs.readFile(abs, 'utf-8');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Cannot read file "${filePath}": ${msg}`);
  }

  const occurrences = content.split(oldString).length - 1;
  if (occurrences === 0) {
    throw new Error(
      `String not found in "${filePath}". Make sure old_string matches exactly (including whitespace).`,
    );
  }
  if (occurrences > 1) {
    throw new Error(
      `old_string appears ${occurrences} times in "${filePath}". Provide more surrounding context to make it unique.`,
    );
  }

  const newContent = content.replace(oldString, newString);

  await printToolCall('edit_file', { path: filePath });
  await printDiff(content, newContent, filePath);

  const decision = await askApproval(`Apply edit to "${filePath}"?`);
  if (decision === 'quit') process.exit(0);
  if (decision === 'no') return `User declined to edit "${filePath}".`;

  await fs.writeFile(abs, newContent, 'utf-8');
  return `File "${filePath}" edited successfully.`;
}

export async function listDirectory(dirPath: string): Promise<string> {
  const abs = path.resolve(dirPath);
  try {
    const entries = await fs.readdir(abs, { withFileTypes: true });
    const lines = entries
      .sort((a, b) => {
        // Directories first, then files
        if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
        return a.name.localeCompare(b.name);
      })
      .map((e) => {
        const suffix = e.isDirectory() ? '/' : '';
        return `${e.name}${suffix}`;
      });
    return lines.join('\n') || '(empty directory)';
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Cannot list directory "${dirPath}": ${msg}`);
  }
}
