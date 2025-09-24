import { Telegraf } from 'telegraf';
import type { PageScanner as IPageScanner } from '../../domain/page-scanner.js';
import { chunkText } from '../util/chunk.js';
import { noPreview, safeEdit, safeSend, sleep } from '../util/messaging.js';
import { normalizeUrl } from '../../core/utils/url.js';
import { mainMenu } from '../ui/menu.js';

export async function performScan(
  bot: Telegraf,
  scanner: IPageScanner,
  chatId: number,
  pages: number,
) {
  const status = await safeSend(bot, chatId, `Scanning ${pages} page(s)… 0/${pages}`, noPreview);
  const statusId = status?.message_id;

  const acc = new Map<string, string[]>(); // Map<url, items[]>, first-wins

  const tasks = Array.from({ length: pages }, (_, i) => i + 1).map(async (p) => {
    const sites = await scanner.scanPage(p);
    for (const s of sites) {
      const url = normalizeUrl(s.url);
      if (acc.has(url)) continue;
      const names = (s.items ?? []).map((i) => i.name);
      if (names.length === 0) continue;
      acc.set(url, names);
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
        `Scanning ${pages} page(s)… ${completed}/${pages}\nUnique URLs with items: ${acc.size}`,
        noPreview,
      );
    }
  }

  if (acc.size === 0) {
    if (statusId)
      await safeEdit(bot, chatId, statusId, `Done. Unique URLs with items: 0.`, noPreview);
    await safeSend(bot, chatId, 'No sites with items found.', noPreview);
    const menu = mainMenu(chatId);
    await safeSend(bot, chatId, 'Choose an action:', {
      ...noPreview,
      reply_markup: menu.reply_markup,
    });
    return;
  }

  const results = [...acc.entries()].map(
    ([url, items], i) => `${i + 1}. ${url} — ${items.join(', ')}`,
  );
  for (const chunk of chunkText(results.join('\n'))) {
    await safeSend(bot, chatId, chunk, noPreview);
    await sleep(250);
  }

  if (statusId)
    await safeEdit(bot, chatId, statusId, `Done. Unique URLs with items: ${acc.size}.`, noPreview);

  const menu = mainMenu(chatId);
  await safeSend(bot, chatId, 'Choose an action:', {
    ...noPreview,
    reply_markup: menu.reply_markup,
  });
}
