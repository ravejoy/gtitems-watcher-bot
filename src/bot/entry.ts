import { Telegraf } from 'telegraf';
import { logger } from '../lib/logger.js';
import type { PageScanner as IPageScanner } from '../domain/page-scanner.js';
import { noPreview, safeSend } from './util/messaging.js';
import { getPages, setPages } from './state/store.js';
import { mainMenu } from './ui/menu.js';
import { performScan } from './handlers/scan.js';
import { performSearch } from './handlers/search.js';
import { wireInputs } from './handlers/inputs.js';

export function createBot(scanner: IPageScanner) {
  const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN as string, {
    handlerTimeout: 10 * 60_000,
  });

  bot.start(async (ctx) => {
    const chatId = ctx.chat!.id;
    const menu = mainMenu(chatId);
    await safeSend(bot, chatId, 'Choose an action:', {
      ...noPreview,
      reply_markup: menu.reply_markup,
    });
  });

  bot.command('menu', async (ctx) => {
    const chatId = ctx.chat!.id;
    const menu = mainMenu(chatId);
    await safeSend(bot, chatId, 'Choose an action:', {
      ...noPreview,
      reply_markup: menu.reply_markup,
    });
  });

  bot.command('setpages', async (ctx) => {
    const chatId = ctx.chat!.id;
    const parts = (ctx.message?.text ?? '').trim().split(/\s+/);
    const n = Number(parts[1]);
    if (!Number.isFinite(n)) return safeSend(bot, chatId, 'Usage: /setpages <number>', noPreview);
    const pages = setPages(chatId, n);
    await safeSend(bot, chatId, `Pages set to ${pages}.`, noPreview);
  });

  bot.command('scan', async (ctx) => {
    const chatId = ctx.chat!.id;
    const parts = (ctx.message?.text ?? '').trim().split(/\s+/);
    const override = Number(parts[1]);
    const pages = Number.isFinite(override) ? setPages(chatId, override) : getPages(chatId);
    await performScan(bot, scanner, chatId, pages);
  });

  bot.command('search', async (ctx) => {
    const chatId = ctx.chat!.id;
    const q = (ctx.message?.text ?? '').slice('/search'.length).trim();
    if (!q)
      return safeSend(bot, chatId, 'Usage: /search <keyword1, keyword2 | keyword3>', noPreview);
    await performSearch(bot, scanner, chatId, getPages(chatId), q);
  });

  bot.action('act_scan', async (ctx) => {
    const chatId = ctx.chat!.id;
    await ctx.answerCbQuery();
    await performScan(bot, scanner, chatId, getPages(chatId));
  });

  bot.action('act_status', async (ctx) => {
    const chatId = ctx.chat!.id;
    await ctx.answerCbQuery();
    await safeSend(bot, chatId, `Pages: ${getPages(chatId)}`, noPreview);
  });

  wireInputs(bot, scanner);

  bot.catch((err) => logger.error({ err }, 'bot error'));
  return bot;
}
