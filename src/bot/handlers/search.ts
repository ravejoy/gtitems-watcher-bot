import { Telegraf } from 'telegraf';
import type { PageScanner as IPageScanner } from '../../domain/page-scanner.js';
import { parseKeywords } from '../../core/utils/search.js';
import { chunkText } from '../util/chunk.js';
import { noPreview, safeEdit, safeSend, sleep } from '../util/messaging.js';

const NEXT_TIP = 'Type /start to continue';

function normalizeUrl(u: string): string {
  const hash = u.indexOf('#');
  return hash >= 0 ? u.slice(0, hash) : u;
}

function normalize(s: string) {
  return s.toLowerCase().replace(/ё/g, 'е');
}

export function filterNamesByKeys(names: string[], keys: string[]): string[] {
  if (!keys.length || !names.length) return [];
  const ks = keys.map(normalize);
  return names.filter((n) => {
    const x = normalize(n);
    return ks.some((k) => x.includes(k));
  });
}

export async function performSearch(
  bot: Telegraf,
  scanner: IPageScanner,
  chatId: number,
  pages: number,
  query: string,
) {
  const keys = parseKeywords(query);
  if (keys.length === 0) {
    await safeSend(bot, chatId, 'No keywords provided.', noPreview);
    await safeSend(bot, chatId, NEXT_TIP, noPreview);
    return;
  }

  const status = await safeSend(
    bot,
    chatId,
    `Searching ${pages} page(s) for: ${keys.join(', ')}… 0/${pages}`,
    noPreview,
  );
  const statusId = status?.message_id;

  // Map<url, items[]>
  const acc = new Map<string, string[]>();

  const tasks = Array.from({ length: pages }, (_, i) => i + 1).map(async (p) => {
    const sites = await scanner.scanPage(p);
    for (const s of sites) {
      const url = normalizeUrl(s.url);
      if (acc.has(url)) continue;

      const names = (s.items ?? []).map((i) => i.name);
      const filtered = filterNamesByKeys(names, keys);
      if (filtered.length === 0) continue;

      acc.set(url, filtered);
    }
  });

  let completed = 0;
  for (const t of tasks) {
    await t;
    completed++;
    if (statusId) {
      await safeEdit(
        bot,
        chatId,
        statusId,
        `Searching ${pages} page(s) for: ${keys.join(', ')}… ${completed}/${pages}\nUnique URLs matched: ${acc.size}`,
        noPreview,
      );
    }
  }

  if (acc.size === 0) {
    if (statusId) {
      await safeEdit(bot, chatId, statusId, `Done. Unique URLs matched: 0.`, noPreview);
    }
    await safeSend(bot, chatId, 'No matches found.', noPreview);
    await safeSend(bot, chatId, NEXT_TIP, noPreview);
    return;
  }

  const results = [...acc.entries()].map(
    ([url, items], i) => `${i + 1}. ${url} — ${items.join(', ')}`,
  );
  for (const chunk of chunkText(results.join('\n'))) {
    await safeSend(bot, chatId, chunk, noPreview);
    await sleep(250);
  }

  if (statusId) {
    await safeEdit(bot, chatId, statusId, `Done. Unique URLs matched: ${acc.size}.`, noPreview);
  }
  await safeSend(bot, chatId, NEXT_TIP, noPreview);
}
