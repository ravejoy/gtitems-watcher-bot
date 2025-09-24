import { describe, it, expect } from 'vitest';
import { filterNamesByKeys } from '../../src/core/utils/search.js';

describe('search filter', () => {
  it('matches names by any keyword (case-insensitive)', () => {
    const names = ['Nectar', 'Fog', 'Meadow patch', 'Flax', 'Banana'];
    expect(filterNamesByKeys(names, ['nect'])).toEqual(['Nectar']);
    expect(filterNamesByKeys(names, ['FOG', 'flax'])).toEqual(['Fog', 'Flax']);
    expect(filterNamesByKeys(names, ['ban'])).toEqual(['Banana']);
    expect(filterNamesByKeys(names, ['xxx'])).toEqual([]);
  });
});
