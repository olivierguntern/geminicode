import type { Content } from '@google/genai';

// Conservative estimate: 1 token ≈ 4 characters
const CHARS_PER_TOKEN = 4;

// 80k token limit — well under Gemini 2.0 Flash's 1M context window
export const MAX_HISTORY_CHARS = 80_000 * CHARS_PER_TOKEN;

function contentSize(content: Content): number {
  return (content.parts ?? []).reduce((acc, part) => {
    if ('text' in part && typeof part.text === 'string') {
      return acc + part.text.length;
    }
    // Rough estimate for non-text parts (tool calls / function responses)
    return acc + 200;
  }, 0);
}

/**
 * Trim conversation history to stay within the context window.
 * Removes the oldest turns first, always keeping at least the last 2 turns.
 */
export function trimHistory(history: Content[], maxChars = MAX_HISTORY_CHARS): Content[] {
  if (history.length <= 2) return history;

  let totalChars = history.reduce((acc, c) => acc + contentSize(c), 0);
  if (totalChars <= maxChars) return history;

  const trimmed = [...history];
  while (totalChars > maxChars && trimmed.length > 2) {
    const removed = trimmed.shift();
    if (removed) totalChars -= contentSize(removed);
  }
  return trimmed;
}
