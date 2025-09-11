// src/bot.ts
import 'dotenv/config';
import { Telegraf, Context } from 'telegraf';
import type { UserPrefs } from './domain/types.js';
import { buildMenu, itemsMenu } from './keyboards.js';
import { logger } from './services/logger.js';
import { scan, type Progress, type FoundSite } from './services/scanner.js';
import { RedisStore } from './storage/redis-store.js';
import type { Store } from './storage/store.js';

/** Extend Telegraf context with a tiny in-memory session */
type SessionMode =
  | 'await_pages'
  | 'await_filters_add'
  | 'await_filters_remove'
  | 'await_filters_replace';

interface SessionData {
  mode?: SessionMode;
}

interface MyContext extends Context {
  session?: SessionData;
}

/* ------------------------------------------------------------------ */

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) throw new Error('Missing BOT_TOKEN in .env');

const store: Store = new RedisStore();
export const bot = new Telegraf<MyContext>(BOT_TOKEN);

/* ------------------------------ utils ------------------------------ */

function chunkByLines(lines: string[], maxLen = 3900): string[] {
  const out: string[] = [];
  let buf = '';
  for (const line of lines) {
    const cand = buf ? `${buf}\n${line}` : line;
    if (cand.length > maxLen) {
      if (buf) out.push(buf);
      if (line.length > maxLen) {
        for (let i = 0; i < line.length; i += maxLen) out.push(line.slice(i, i + maxLen));
        buf = '';
      } else {
        buf = line;
      }
    } else {
      buf = cand;
    }
  }
  if (buf) out.push(buf);
  return out;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

async function ensurePrefs(userId: number): Promise<UserPrefs> {
  const existing = await store.getPrefs(userId);
  if (existing) return existing;
  const def: UserPrefs = {
    userId,
    pages: Number(process.env.DEFAULT_PAGES ?? 20),
    subscribed: false,
    filters: [],
    updatedAt: Date.now(),
  };
  await store.upsertPrefs(def);
  return def;
}

async function showMainMenu(userId: number, chatId: number) {
  const p = await ensurePrefs(userId);
  await bot.telegram.sendMessage(chatId, 'Choose an action:', buildMenu(p.pages, p.subscribed));
}

/* ----------------------------- routes ------------------------------ */

bot.start(async (ctx) => {
  const uid = ctx.from?.id;
  const cid = ctx.chat?.id;
  if (uid == null || cid == null) return;
  await ensurePrefs(uid);
  await showMainMenu(uid, cid);
});

bot.hears(/^menu$/i, async (ctx) => {
  const uid = ctx.from?.id;
  const cid = ctx.chat?.id;
  if (uid == null || cid == null) return;
  await showMainMenu(uid, cid);
});

/* ---------------------------- status/menu -------------------------- */

bot.action('status', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const p = await ensurePrefs(ctx.from!.id);
  const filters = p.filters.length ? p.filters.join(', ') : '—';
  await ctx.reply(
    `Pages: ${p.pages}\nSubscribed: ${p.subscribed ? 'ON' : 'OFF'}\nFilters: ${filters}`,
    { disable_web_page_preview: true },
  );
  await showMainMenu(ctx.from!.id, ctx.chat!.id);
});

/* ----------------------------- pages setup ------------------------- */

bot.action('set_pages', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  await ctx.reply('Send the number of rating pages to scan (1–200).');
  ctx.session = { mode: 'await_pages' };
});

bot.on('text', async (ctx, next) => {
  const sess = ctx.session;
  if (!sess?.mode) return next();

  const uid = ctx.from!.id;
  const cid = ctx.chat!.id;

  if (sess.mode === 'await_pages') {
    const raw = ctx.message.text.trim();
    const num = Number(raw);
    if (!Number.isFinite(num)) {
      await ctx.reply('Please send a number (1–200). Example: 30');
      return;
    }
    const p = await ensurePrefs(uid);
    p.pages = clamp(Math.floor(num), 1, 200);
    p.updatedAt = Date.now();
    await store.upsertPrefs(p);
    await ctx.reply(`Pages set to: ${p.pages}`);
    ctx.session = undefined;
    await showMainMenu(uid, cid);
    return;
  }

  if (sess.mode === 'await_filters_add') {
    const add = ctx.message.text
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    const p = await ensurePrefs(uid);
    const set = new Set([...p.filters, ...add].map((x) => x.toLowerCase()));
    p.filters = [...set];
    p.updatedAt = Date.now();
    await store.upsertPrefs(p);
    await ctx.reply(`Added: ${add.join(', ') || '—'}`);
    ctx.session = undefined;
    await showMainMenu(uid, cid);
    return;
  }

  if (sess.mode === 'await_filters_remove') {
    const rem = ctx.message.text
      .split(',')
      .map((x) => x.trim().toLowerCase())
      .filter(Boolean);
    const p = await ensurePrefs(uid);
    p.filters = p.filters.filter((x) => !rem.includes(x.toLowerCase()));
    p.updatedAt = Date.now();
    await store.upsertPrefs(p);
    await ctx.reply(`Removed: ${rem.join(', ') || '—'}`);
    ctx.session = undefined;
    await showMainMenu(uid, cid);
    return;
  }

  if (sess.mode === 'await_filters_replace') {
    const next = ctx.message.text
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    const p = await ensurePrefs(uid);
    p.filters = next;
    p.updatedAt = Date.now();
    await store.upsertPrefs(p);
    await ctx.reply(`Replaced. Current: ${p.filters.join(', ') || '—'}`);
    ctx.session = undefined;
    await showMainMenu(uid, cid);
    return;
  }

  return next();
});

/* ------------------------ subscription submenu --------------------- */

bot.action('sub_toggle', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const p = await ensurePrefs(ctx.from!.id);
  p.subscribed = !p.subscribed;
  p.updatedAt = Date.now();
  await store.upsertPrefs(p);
  await ctx.reply(`Subscription is now ${p.subscribed ? 'ON' : 'OFF'}.`);
  await showMainMenu(ctx.from!.id, ctx.chat!.id);
});

bot.action('sub_items_menu', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  await ctx.reply('Subscription settings:', itemsMenu);
});

bot.action('sub_add', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  await ctx.reply('Enter item names to ADD (comma separated):');
  ctx.session = { mode: 'await_filters_add' };
});

bot.action('sub_remove', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  await ctx.reply('Enter item names to REMOVE (comma separated):');
  ctx.session = { mode: 'await_filters_remove' };
});

bot.action('sub_replace', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  await ctx.reply('Enter item names to REPLACE list (comma separated):');
  ctx.session = { mode: 'await_filters_replace' };
});

bot.action('sub_show', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const p = await ensurePrefs(ctx.from!.id);
  const list = p.filters.length ? p.filters.join(', ') : '—';
  await ctx.reply(`Current filters: ${list}`, { disable_web_page_preview: true });
});

bot.action('back_main', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  await showMainMenu(ctx.from!.id, ctx.chat!.id);
});

/* ------------------------------ scan ------------------------------- */

bot.action('scan', async (ctx) => {
  const uid = ctx.from?.id;
  const cid = ctx.chat?.id;
  if (uid == null || cid == null) return;
  await ctx.answerCbQuery().catch(() => {});

  const prefs = await ensurePrefs(uid);
  const pages = prefs.pages;

  const progressMsg = await ctx.reply(`Starting scan (pages=${pages})…`);

  let lastEdit = 0;
  let last: Progress = { done: 0, total: 0, matches: 0 };

  const onProgress = async (p: Progress) => {
    last = p; // keep the latest snapshot
    const now = Date.now();
    if (now - lastEdit < 700) return;
    lastEdit = now;
    const text =
      `Progress: ${p.done}/${p.total} (${Math.floor((p.done / Math.max(1, p.total)) * 100)}%)\n` +
      `Matches: ${p.matches}\n` +
      `Pages: ${pages}`;
    await bot.telegram
      .editMessageText(progressMsg.chat.id, progressMsg.message_id, undefined, text)
      .catch((err) => logger.debug({ err }, 'editMessageText ignored'));
  };

  try {
    const found: FoundSite[] = await scan(pages, 8, onProgress);

    const header = `Checked: ${last.total}\n` + `Pages: ${pages}\n` + `Matches: ${found.length}`;
    await bot.telegram
      .editMessageText(progressMsg.chat.id, progressMsg.message_id, undefined, header)
      .catch(async () => {
        await ctx.reply(header, { disable_web_page_preview: true });
      });

    const filters = (prefs.filters ?? []).map((s) => s.toLowerCase());
    const visible =
      filters.length === 0
        ? found
        : found
            .map((s) => ({
              ...s,
              items: s.items.filter((name) => filters.some((f) => name.toLowerCase().includes(f))),
            }))
            .filter((s) => s.items.length > 0);

    const lines =
      visible.length > 0 ? visible.map((s) => `• ${s.url} — ${s.items.join(', ')}`) : ['(none)'];

    for (const part of chunkByLines(lines)) {
      await ctx.reply(part, { disable_web_page_preview: true });
    }
  } catch (e) {
    await ctx.reply(`Error: ${(e as Error).message}`, { disable_web_page_preview: true });
  }

  await showMainMenu(uid, cid);
});

/* ---------------------------- launch/stop -------------------------- */

export async function launchBot() {
  await bot.launch();
  logger.info('Bot launched');
}

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
