import { describe, it, expect, beforeEach } from 'vitest';
import { parsePages, applyPages } from '../../src/bot/handlers/pages.js';
import { resetStore } from '../../src/bot/state/store.js';

describe('pages handler', () => {
  beforeEach(() => resetStore());

  it('parsePages accepts integers and clamps to 1..100', () => {
    expect(parsePages('5')).toBe(5);
    expect(parsePages('  12 ')).toBe(12);
    expect(parsePages('0')).toBe(1);
    expect(parsePages('-3')).toBe(1);
    expect(parsePages('150')).toBe(100);
    expect(parsePages('3.8')).toBe(3);
    expect(parsePages('abc')).toBeNull();
  });

  it('applyPages stores and returns confirmation', () => {
    const msg = applyPages(12345, '7');
    expect(msg).toBe('Pages set to 7.');
  });

  it('applyPages rejects invalid input', () => {
    const msg = applyPages(12345, 'nope');
    expect(msg).toBe('Please send a number.');
  });
});
