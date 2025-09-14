import { describe, it, expect } from 'vitest';
import { parseKeywords } from '../src/core/utils/search.js';

describe('parseKeywords', () => {
  it('splits by comma and |, trims and lowercases', () => {
    expect(parseKeywords('Nectar,  Туман | лён')).toEqual(['nectar', 'туман', 'лён']);
  });
  it('ignores empty parts', () => {
    expect(parseKeywords(' , ,  foo |  ')).toEqual(['foo']);
  });
});
