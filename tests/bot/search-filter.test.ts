import { describe, it, expect } from 'vitest';
import { filterNamesByKeys } from '../../src/bot/handlers/search.js';

describe('search filter', () => {
  it('matches names by any keyword (case-insensitive)', () => {
    const names = ['Нектар', 'Туман', 'Луговая грядка', 'Лён', 'Banana'];
    expect(filterNamesByKeys(names, ['нект'])).toEqual(['Нектар']);
    expect(filterNamesByKeys(names, ['ТУМ', 'лен'])).toEqual(['Туман', 'Лён']);
    expect(filterNamesByKeys(names, ['ban'])).toEqual(['Banana']);
    expect(filterNamesByKeys(names, ['xxx'])).toEqual([]);
  });
});
