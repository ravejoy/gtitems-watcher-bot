import { Telegraf, Markup } from 'telegraf';
import type { PageScanner as IPageScanner } from '../domain/page-scanner.js';
import { logger } from '../lib/logger.js';
import { env } from '../lib/env.js';

type ChatSettings = { pages: number };
const chatSettings = new Map<number, ChatSettings>();

function getSettings(chatId: number): ChatSettings {
  const s = chatSettings.get(chatId);
  if (s) return s;
  const def = { pages: 1 };
  chatSettings.set(chatId, def);
  return def;
}
function setPages(chatId: number, pages: number) {
  const clamped = Math.min(Math.max(Math.trunc(pages), 1), 10);
  chatSettings.set(chatId, { pages: clamped });
  return clamped;
}

function chunkText(input: string, limit = 3500): string[] {
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

function mainMenu(pages: number) {
  return Markup.inlineKeyboard([
    [Markup.button.callback(`🔎 Scan (${pages} page${pages > 1 ? 's' : ''})`, 'scan_now')],
    [
      Markup.button.callback('1', 'set_pages:1'),
      Markup.button.callback('3', 'set_pages:3'),
      Markup.button.callback('5', 'set_pages:5'),
      Markup.button.callback('10', 'set_pages:10'),
    ],
  ]);
}

// unified option to disable link previews (new Bot API)
const noPreview = { link_preview_options: { is_disabled: true as const } };

export function createBot(scanner: IPageScanner) {
  const bot = new Telegraf(env.TELEGRAM_BOT_TOKEN);

  bot.start(async (ctx) => {
    const chatId = ctx.chat?.id as number;
    const pages = getSettings(chatId).pages;
    const menu = mainMenu(pages);
    await ctx.reply(
      'Use /scan <pages?> or the buttons below. I will list review URLs that have items.',
      { ...noPreview, reply_markup: menu.reply_markup },
    );
  });

  bot.command('menu', async (ctx) => {
    const chatId = ctx.chat?.id as number;
    const pages = getSettings(chatId).pages;
    const menu = mainMenu(pages);
    await ctx.reply(`Current pages: ${pages}`, {
      ...noPreview,
      reply_markup: menu.reply_markup,
    });
  });

  bot.command('setpages', async (ctx) => {
    const chatId = ctx.chat?.id as number;
    const parts = (ctx.message?.text ?? '').trim().split(/\s+/);
    const n = Number(parts[1]);
    if (!Number.isFinite(n)) {
      return ctx.reply('Usage: /setpages <1..10>', noPreview);
    }
    const pages = setPages(chatId, n);
    const menu = mainMenu(pages);
    await ctx.reply(`Pages set to ${pages}.`, {
      ...noPreview,
      reply_markup: menu.reply_markup,
    });
  });

  bot.command('scan', async (ctx) => {
    const chatId = ctx.chat?.id as number;
    const parts = (ctx.message?.text ?? '').trim().split(/\s+/);
    const override = Number(parts[1]);
    const pages = Number.isFinite(override)
      ? setPages(chatId, override)
      : getSettings(chatId).pages;
    await performScan(chatId, pages);
  });

  bot.action('scan_now', async (ctx) => {
    const chatId = ctx.chat?.id as number;
    const pages = getSettings(chatId).pages;
    await ctx.answerCbQuery('Scanning…');
    await performScan(chatId, pages);
  });

  bot.action(/^set_pages:(\d+)$/, async (ctx) => {
    const chatId = ctx.chat?.id as number;
    const n = Number(ctx.match[1]);
    const pages = setPages(chatId, n);
    await ctx.answerCbQuery(`Pages set to ${pages}`);
    const menu = mainMenu(pages);
    await ctx.editMessageReplyMarkup(menu.reply_markup);
  });

  bot.catch((err) => logger.error({ err }, 'bot error'));

  async function performScan(chatId: number, pages: number) {
    const send = (text: string) => bot.telegram.sendMessage(chatId, text, noPreview);

    // progress message
    const status = await send(`Scanning ${pages} page(s)… 0/${pages}`);
    const statusMsgId = status.message_id;

    const uniqueUrls = new Set<string>();
    const results: { url: string; items: string[] }[] = [];

    for (let p = 1; p <= pages; p++) {
      const sites = await scanner.scanPage(p);

      for (const s of sites) {
        if (!uniqueUrls.has(s.url)) uniqueUrls.add(s.url);
        const names = (s.items ?? []).map((i) => i.name);
        if (names.length > 0) results.push({ url: s.url, items: names });
      }

      // update progress after each page to avoid long silent periods
      const progressText =
        `Scanning ${pages} page(s)… ${p}/${pages}\n` +
        `Checked (unique): ${uniqueUrls.size} • Found (with items): ${results.length}`;
      try {
        await bot.telegram.editMessageText(chatId, statusMsgId, undefined, progressText, noPreview);
      } catch {
        // ignore edit race conditions / rate limits
      }
    }

    if (results.length === 0) {
      try {
        await bot.telegram.editMessageText(
          chatId,
          statusMsgId,
          undefined,
          `Done. Checked ${uniqueUrls.size} unique site(s). Found 0.`,
          noPreview,
        );
      } catch {}
      await send('No sites with items found.');
      return;
    }

    const lines = results.map((r, i) => `${i + 1}. ${r.url} — ${r.items.join(', ')}`);
    const payload = lines.join('\n');
    for (const chunk of chunkText(payload)) {
      await send(chunk);
    }

    try {
      await bot.telegram.editMessageText(
        chatId,
        statusMsgId,
        undefined,
        `Done. Checked ${uniqueUrls.size} unique site(s). Found ${results.length}.`,
        noPreview,
      );
    } catch {}
  }

  return bot;
}
