import { Telegraf } from 'telegraf';
import { noPreview, safeSend } from '../utils/messaging.js';
import {
  getPages,
  isAwaitingPages,
  isAwaitingSearch,
  setAwaitingPages,
  setAwaitingSearch,
} from '../state/store.js';
import { performSearch } from './search.js';
import type { PageScanner as IPageScanner } from '../../domain/page-scanner.js';
import { applyPages } from './pages.js';
import { mainMenu } from '../ui/menu.js';

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
      'Send search query (e.g., `nectar, fog | flax`). Multiple keywords allowed.',
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
      const msg = applyPages(chatId, text);
      await safeSend(bot, chatId, msg, noPreview);
      const menu = mainMenu(chatId);
      await safeSend(bot, chatId, 'Choose an action:', {
        ...noPreview,
        reply_markup: menu.reply_markup,
      });
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
