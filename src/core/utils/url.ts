export function normalizeUrl(u: string): string {
  const i = u.indexOf('#');
  return i >= 0 ? u.slice(0, i) : u;
}
