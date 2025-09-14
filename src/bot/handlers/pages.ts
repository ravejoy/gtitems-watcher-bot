import { setPages } from '../state/store.js';

export function parsePages(input: string): number | null {
  const n = Number(String(input).trim());
  if (!Number.isFinite(n)) return null;
  const v = Math.max(1, Math.min(Math.trunc(n), 100));
  return v;
}

export function applyPages(chatId: number, input: string): string {
  const v = parsePages(input);
  if (v === null) return 'Please send a number.';
  const pages = setPages(chatId, v);
  return `Pages set to ${pages}.`;
}
