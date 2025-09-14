export function chunkText(input: string, limit = 3500): string[] {
  if (input.length <= limit) return [input];
  const out: string[] = [];
  let buf = '';
  for (const line of input.split('\n')) {
    if ((buf + line + '\n').length > limit) {
      out.push(buf.trimEnd());
      buf = '';
    }
    buf += line + '\n';
  }
  if (buf) out.push(buf.trimEnd());
  return out;
}
