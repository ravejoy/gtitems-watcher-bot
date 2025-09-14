export function parseKeywords(input: string): string[] {
  return input
    .split(/[|,]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}
