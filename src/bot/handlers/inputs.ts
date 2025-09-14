import { Telegraf } from 'telegraf';
import { noPreview, safeSend } from '../util/messaging.js';
import {
  getPages,
  isAwaitingPages,
  isAwaitingSearch,
  setAwaitingPages,
  setAwaitingSearch,
  setPages,
} from '../state/store.js';
import { performSearch } from './search.js';
import type { PageScanner as IPageScanner } from '../../domain/page-scanner.js';
import { nextStepsText } from '../ui/text.js';

export function wireInputs(bot: Telegraf, scanner: IPageScanner) {
  bot.action('act_set_pages', async (ctx) => {
    const chatId = ctx.chat!.id;
    setAwaitingPages(chatId, true);
    await ctx.answerCbQuery();
    await safeSend(bot, chatId, 'Send number of pages to scan (1..100):', noPreview);
  });

  bot.action('act_search', async (ctx) => {
    const chatId = ctx.chat!.id;
    setAwaitingSearch(chatId, true);
    await ctx.answerCbQuery();
    await safeSend(
      bot,
      chatId,
      'Send search query (e.g., `nectar, туман | лён`). Multiple keywords allowed.',
      {
        ...noPreview,
        parse_mode: 'Markdown',
      },
    );
  });

  bot.on('text', async (ctx, next) => {
    const chatId = ctx.chat!.id;
    const text = ctx.message?.text?.trim() ?? '';

    if (isAwaitingPages(chatId)) {
      setAwaitingPages(chatId, false);
      const n = Number(text);
      if (!Number.isFinite(n)) return safeSend(bot, chatId, 'Please send a number.', noPreview);
      const pages = setPages(chatId, n);
      await safeSend(bot, chatId, `Pages set to ${pages}.`, noPreview);
      await safeSend(bot, chatId, nextStepsText(), noPreview);
      return;
    }

    if (isAwaitingSearch(chatId)) {
      setAwaitingSearch(chatId, false);
      await performSearch(bot, scanner, chatId, getPages(chatId), text);
      return;
    }

    return next();
  });
}
