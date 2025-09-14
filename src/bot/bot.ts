import { Telegraf, Markup } from 'telegraf';
import { message } from 'telegraf/filters';
import type { PageScanner as IPageScanner } from '../domain/page-scanner.js';
import { logger } from '../lib/logger.js';
import { env } from '../lib/env.js';

// ---- per-chat settings ----
type ChatSettings = { pages: number };
const settings = new Map<number, ChatSettings>();
const awaitingPagesInput = new Set<number>();
const awaitingSearchInput = new Set<number>();

const noPreview = { link_preview_options: { is_disabled: true as const } };

function getPages(chatId: number) {
  return settings.get(chatId)?.pages ?? 1;
}
function setPages(chatId: number, n: number) {
  const pages = Math.max(1, Math.min(Math.trunc(n), 100));
  settings.set(chatId, { pages });
  return pages;
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

function parseKeywords(input: string): string[] {
  return input
    .split(/[|,]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function mainMenu(chatId: number) {
  const pages = getPages(chatId);
  return Markup.inlineKeyboard([
    [Markup.button.callback('Scan', 'act_scan'), Markup.button.callback('Search', 'act_search')],
    [
      Markup.button.callback(`Pages: ${pages} (set)`, 'act_set_pages'),
      Markup.button.callback('Status', 'act_status'),
    ],
  ]);
}

// ---- bot ----
export function createBot(scanner: IPageScanner) {
  const bot = new Telegraf(env.TELEGRAM_BOT_TOKEN, {
    handlerTimeout: 10 * 60_000, // disable 90s telegraf timeout (long scans)
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
    const menu = mainMenu(chatId);
    await safeSend(bot, chatId, `Pages set to ${pages}.`, {
      ...noPreview,
      reply_markup: menu.reply_markup,
    });
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

  // ----- actions -----
  bot.action('act_scan', async (ctx) => {
    const chatId = ctx.chat!.id;
    await ctx.answerCbQuery();
    await performScan(bot, scanner, chatId, getPages(chatId));
  });

  bot.action('act_search', async (ctx) => {
    const chatId = ctx.chat!.id;
    awaitingSearchInput.add(chatId);
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

  bot.action('act_set_pages', async (ctx) => {
    const chatId = ctx.chat!.id;
    awaitingPagesInput.add(chatId);
    await ctx.answerCbQuery();
    await safeSend(bot, chatId, 'Send number of pages to scan (1..100):', noPreview);
  });

  bot.action('act_status', async (ctx) => {
    const chatId = ctx.chat!.id;
    await ctx.answerCbQuery();
    const menu = mainMenu(chatId);
    await safeSend(bot, chatId, `Pages: ${getPages(chatId)}`, {
      ...noPreview,
      reply_markup: menu.reply_markup,
    });
  });

  // ----- awaited inputs -----
  bot.on(message('text'), async (ctx, next) => {
    const chatId = ctx.chat!.id;
    const text = ctx.message.text.trim();

    if (awaitingPagesInput.has(chatId)) {
      awaitingPagesInput.delete(chatId);
      const n = Number(text);
      if (!Number.isFinite(n)) return safeSend(bot, chatId, 'Please send a number.', noPreview);
      const pages = setPages(chatId, n);
      const menu = mainMenu(chatId);
      return safeSend(bot, chatId, `Pages set to ${pages}.`, {
        ...noPreview,
        reply_markup: menu.reply_markup,
      });
    }

    if (awaitingSearchInput.has(chatId)) {
      awaitingSearchInput.delete(chatId);
      return performSearch(bot, scanner, chatId, getPages(chatId), text);
    }

    return next();
  });

  bot.catch((err) => logger.error({ err }, 'bot error'));
  return bot;
}

// ---- helpers ----
async function safeSend(bot: Telegraf, chatId: number, text: string, options?: any) {
  try {
    return await bot.telegram.sendMessage(chatId, text, options);
  } catch (e) {
    // avoid crashing on rate limits or connection hiccups
    return undefined;
  }
}

async function safeEdit(
  bot: Telegraf,
  chatId: number,
  messageId: number,
  text: string,
  options?: any,
) {
  try {
    await bot.telegram.editMessageText(chatId, messageId, undefined, text, options);
  } catch {
    // ignore editing races
  }
}

// run pages in parallel; update progress when each page finishes
async function performScan(bot: Telegraf, scanner: IPageScanner, chatId: number, pages: number) {
  const status = await safeSend(bot, chatId, `Scanning ${pages} page(s)… 0/${pages}`, noPreview);
  const statusId = status?.message_id;

  const unique = new Set<string>();
  const found: { url: string; items: string[] }[] = [];

  // kick all pages at once
  const tasks = Array.from({ length: pages }, (_, i) => i + 1).map(async (p) => {
    const sites = await scanner.scanPage(p);
    for (const s of sites) {
      unique.add(s.url);
      const names = (s.items ?? []).map((i) => i.name);
      if (names.length > 0) found.push({ url: s.url, items: names });
    }
    if (statusId) {
      const done = Math.min(
        pages,
        // progress = #pages completed (approx by counting resolved tasks)
        // we compute from found+unique indirectly is unreliable; keep separate counter below
        0,
      );
    }
  });

  // track how many pages have finished to show jumping progress
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
    return;
  }

  const lines = found.map((r, i) => `${i + 1}. ${r.url} — ${r.items.join(', ')}`);
  for (const chunk of chunkText(lines.join('\n'))) {
    await safeSend(bot, chatId, chunk, noPreview);
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
}

async function performSearch(
  bot: Telegraf,
  scanner: IPageScanner,
  chatId: number,
  pages: number,
  query: string,
) {
  const keys = parseKeywords(query);
  if (keys.length === 0) {
    await safeSend(bot, chatId, 'No keywords provided.', noPreview);
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

  // parallel pages
  const tasks = Array.from({ length: pages }, (_, i) => i + 1).map(async (p) => {
    const sites = await scanner.scanPage(p);
    for (const s of sites) {
      unique.add(s.url);
      const names = (s.items ?? []).map((i) => i.name);
      const filtered = names.filter((n) => keys.some((k) => n.toLowerCase().includes(k)));
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
    return;
  }

  const lines = matches.map((r, i) => `${i + 1}. ${r.url} — ${r.items.join(', ')}`);
  for (const chunk of chunkText(lines.join('\n'))) {
    await safeSend(bot, chatId, chunk, noPreview);
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
}
