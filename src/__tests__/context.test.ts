import { describe, it, expect } from 'vitest';
import { trimHistory } from '../context.js';
import type { Content } from '@google/genai';

function makeTextTurn(role: 'user' | 'model', text: string): Content {
  return { role, parts: [{ text }] };
}

describe('trimHistory', () => {
  it('returns history unchanged when under the limit', () => {
    const history = [
      makeTextTurn('user', 'Hello'),
      makeTextTurn('model', 'Hi there!'),
    ];
    const result = trimHistory(history, 10_000);
    expect(result).toEqual(history);
  });

  it('returns history unchanged when exactly 2 turns', () => {
    const text = 'x'.repeat(1000);
    const history = [makeTextTurn('user', text), makeTextTurn('model', text)];
    // Even if over limit, keeps at least 2 turns
    const result = trimHistory(history, 100);
    expect(result).toHaveLength(2);
  });

  it('trims oldest turns when over the limit', () => {
    const big = 'a'.repeat(500);
    const history: Content[] = [
      makeTextTurn('user', big),   // old — should be trimmed
      makeTextTurn('model', big),  // old — should be trimmed
      makeTextTurn('user', 'recent question'),
      makeTextTurn('model', 'recent answer'),
    ];
    // maxChars = 600 — big turns (500 chars each) push total to ~2000
    const result = trimHistory(history, 600);
    expect(result.length).toBeLessThan(history.length);
    // Last 2 turns are always kept
    const last = result[result.length - 1];
    expect((last.parts![0] as { text: string }).text).toBe('recent answer');
  });

  it('returns empty array unchanged', () => {
    expect(trimHistory([])).toEqual([]);
  });

  it('keeps at least 2 turns regardless of size', () => {
    const huge = 'z'.repeat(1_000_000);
    const history = [makeTextTurn('user', huge), makeTextTurn('model', huge)];
    const result = trimHistory(history, 1); // absurdly small limit
    expect(result).toHaveLength(2);
  });
});
