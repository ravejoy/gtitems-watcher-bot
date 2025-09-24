export function parseKeywords(input: string): string[] {
  const str = (input ?? '').trim();
  if (!str) return [];
  const raw = str
    .split(/[|,]/g)
    .map((s) => s.trim())
    .filter(Boolean);
  return Array.from(new Set(raw));
}

export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '');
}

export function filterNamesByKeys(names: string[], keys: string[]): string[] {
  if (!Array.isArray(names) || !Array.isArray(keys) || keys.length === 0 || names.length === 0)
    return [];
  const ks = keys.map(normalizeText);
  return names.filter((n) => {
    const x = normalizeText(n);
    return ks.some((k) => x.includes(k));
  });
}
