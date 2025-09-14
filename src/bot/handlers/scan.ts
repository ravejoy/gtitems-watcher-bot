import { Telegraf } from 'telegraf';
import type { PageScanner as IPageScanner } from '../../domain/page-scanner.js';
import { chunkText } from '../util/chunk.js';
import { noPreview, safeEdit, safeSend, sleep } from '../util/messaging.js';
import { nextStepsText } from '../ui/text.js';

export async function performScan(
  bot: Telegraf,
  scanner: IPageScanner,
  chatId: number,
  pages: number,
) {
  const status = await safeSend(bot, chatId, `Scanning ${pages} page(s)… 0/${pages}`, noPreview);
  const statusId = status?.message_id;

  const unique = new Set<string>();
  const found: { url: string; items: string[] }[] = [];

  const tasks = Array.from({ length: pages }, (_, i) => i + 1).map(async (p) => {
    const sites = await scanner.scanPage(p);
    for (const s of sites) {
      unique.add(s.url);
      const names = (s.items ?? []).map((i) => i.name);
      if (names.length > 0) found.push({ url: s.url, items: names });
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
        `Scanning ${pages} page(s)… ${completed}/${pages}\nChecked (unique): ${unique.size} • Found: ${found.length}`,
        noPreview,
      );
    }
  }

  if (found.length === 0) {
    if (statusId) {
      await safeEdit(
        bot,
        chatId,
        statusId,
        `Done. Checked ${unique.size} unique site(s). Found 0.`,
        noPreview,
      );
    }
    await safeSend(bot, chatId, 'No sites with items found.', noPreview);
    await safeSend(bot, chatId, nextStepsText(), noPreview);
    return;
  }

  const lines = found.map((r, i) => `${i + 1}. ${r.url} — ${r.items.join(', ')}`);
  for (const chunk of chunkText(lines.join('\n'))) {
    await safeSend(bot, chatId, chunk, noPreview);
    await sleep(250);
  }

  if (statusId) {
    await safeEdit(
      bot,
      chatId,
      statusId,
      `Done. Checked ${unique.size} unique site(s). Found ${found.length}.`,
      noPreview,
    );
  }
  await safeSend(bot, chatId, nextStepsText(), noPreview);
}
