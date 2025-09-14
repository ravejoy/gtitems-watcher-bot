import { Telegraf } from 'telegraf';
import type { PageScanner as IPageScanner } from '../../domain/page-scanner.js';
import { parseKeywords } from '../../core/utils/search.js';
import { chunkText } from '../util/chunk.js';
import { noPreview, safeEdit, safeSend, sleep } from '../util/messaging.js';

const NEXT_TIP = 'Type /start to continue';

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

  const unique = new Set<string>();
  const matches: { url: string; items: string[] }[] = [];

  const tasks = Array.from({ length: pages }, (_, i) => i + 1).map(async (p) => {
    const sites = await scanner.scanPage(p);
    for (const s of sites) {
      unique.add(s.url);
      const names = (s.items ?? []).map((i) => i.name);
      const filtered = filterNamesByKeys(names, keys);
      if (filtered.length > 0) matches.push({ url: s.url, items: filtered });
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
        `Searching ${pages} page(s) for: ${keys.join(', ')}… ${completed}/${pages}\nChecked (unique): ${unique.size} • Matches: ${matches.length}`,
        noPreview,
      );
    }
  }

  if (matches.length === 0) {
    if (statusId) {
      await safeEdit(
        bot,
        chatId,
        statusId,
        `Done. Checked ${unique.size} unique site(s). Matches: 0.`,
        noPreview,
      );
    }
    await safeSend(bot, chatId, 'No matches found.', noPreview);
    await safeSend(bot, chatId, NEXT_TIP, noPreview);
    return;
  }

  const lines = matches.map((r, i) => `${i + 1}. ${r.url} — ${r.items.join(', ')}`);
  for (const chunk of chunkText(lines.join('\n'))) {
    await safeSend(bot, chatId, chunk, noPreview);
    await sleep(250);
  }

  if (statusId) {
    await safeEdit(
      bot,
      chatId,
      statusId,
      `Done. Checked ${unique.size} unique site(s). Matches: ${matches.length}.`,
      noPreview,
    );
  }
  await safeSend(bot, chatId, NEXT_TIP, noPreview);
}
