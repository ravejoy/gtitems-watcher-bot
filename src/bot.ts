import 'dotenv/config';
import { Telegraf, Context } from 'telegraf';
import type { UserPrefs } from './domain/types.js';
import { buildMenu, itemsMenu } from './keyboards.js';
import { logger } from './services/logger.js';
import { scan, type Progress, type FoundSite } from './services/scanner.js';
import { RedisStore } from './storage/redis-store.js';
import type { Store } from './storage/store.js';

type SessionMode =
  | 'await_pages'
  | 'await_filters_add'
  | 'await_filters_remove'
  | 'await_filters_replace'
  | 'await_search_terms';

interface SessionData {
  mode?: SessionMode;
  searchTerms?: string[]; // for search flow
}

interface MyContext extends Context {
  session?: SessionData;
}

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) throw new Error('Missing BOT_TOKEN in .env');

const store: Store = new RedisStore();
export const bot = new Telegraf<MyContext>(BOT_TOKEN, {
  handlerTimeout: Infinity,
});

// global error catcher
bot.catch((err, ctx) => {
  logger.error({ err }, 'Unhandled error in Telegraf');
  ctx.reply('⚠️ Unexpected error, but bot is still running.').catch(() => {});
});
const memorySession = new Map<number, SessionData>();

bot.use(async (ctx, next) => {
  const cid = ctx.chat?.id;
  if (cid != null) {
    // load session for this chat
    ctx.session = memorySession.get(cid) ?? {};
  }

  await next();

  if (cid != null) {
    // persist session back
    memorySession.set(cid, ctx.session ?? {});
  }
});

/* ------------------------------ helpers ------------------------------ */

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

function normalizeSearchTerms(input: string): string[] {
  return input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.toLowerCase());
}

function filterSitesByTerms(sites: FoundSite[], terms: string[]): FoundSite[] {
  if (terms.length === 0) return [];
  return sites
    .map((s) => ({
      ...s,
      items: s.items.filter((name) => {
        const lower = name.toLowerCase();
        return terms.some((t) => lower.includes(t));
      }),
    }))
    .filter((s) => s.items.length > 0);
}

/* ------------------------------- routes ------------------------------ */

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

/* --------------------------- status & pages -------------------------- */

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

bot.action('set_pages', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  await ctx.reply('Send the number of rating pages to scan (1–200).');
  ctx.session = { mode: 'await_pages' };
});

/* ---------------------------- text handler --------------------------- */

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
    const nextVals = ctx.message.text
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
    const p = await ensurePrefs(uid);
    p.filters = nextVals;
    p.updatedAt = Date.now();
    await store.upsertPrefs(p);
    await ctx.reply(`Replaced. Current: ${p.filters.join(', ') || '—'}`);
    ctx.session = undefined;
    await showMainMenu(uid, cid);
    return;
  }

  if (sess.mode === 'await_search_terms') {
    const terms = normalizeSearchTerms(ctx.message.text);
    if (terms.length === 0) {
      await ctx.reply('Please enter at least one item name (comma separated).');
      return;
    }
    ctx.session = undefined; // clear session before running
    await performSearch(ctx, terms);
    return;
  }

  return next();
});

/* ----------------------- subscription submenu ----------------------- */

bot.action('sub_toggle', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  const uid = ctx.from!.id;
  const cid = ctx.chat!.id;

  const p = await ensurePrefs(uid);
  p.subscribed = !p.subscribed;
  p.updatedAt = Date.now();
  await store.upsertPrefs(p);

  await ctx.reply(`Subscription is now ${p.subscribed ? 'ON' : 'OFF'}.`);

  if (p.subscribed) {
    // run an immediate search using saved filters (if any)
    const terms = p.filters.map((s) => s.toLowerCase()).filter(Boolean);
    if (terms.length === 0) {
      await ctx.reply('No filters set for subscription. Use “Subscription settings” to add items.');
    } else {
      await ctx.reply(`Running immediate search with filters: ${terms.join(', ')}`);
      await performSearch(ctx as MyContext, terms);
      return; // performSearch already shows menu at the end
    }
  }

  await showMainMenu(uid, cid);
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

/* ------------------------------- SCAN ------------------------------- */

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
    last = p;
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

    const header = `Checked: ${last.total}\nPages: ${pages}\nMatches: ${found.length}`;
    await bot.telegram
      .editMessageText(progressMsg.chat.id, progressMsg.message_id, undefined, header)
      .catch(async () => {
        await ctx.reply(header, { disable_web_page_preview: true });
      });

    const lines =
      found.length > 0 ? found.map((s) => `• ${s.url} — ${s.items.join(', ')}`) : ['(none)'];

    for (const part of chunkByLines(lines)) {
      await ctx.reply(part, { disable_web_page_preview: true });
    }
  } catch (e) {
    await ctx.reply(`Error: ${(e as Error).message}`, { disable_web_page_preview: true });
  }

  await showMainMenu(uid, cid);
});

/* ------------------------------ SEARCH ----------------------------- */

bot.action('search_names', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {});
  await ctx.reply('Enter item names to SEARCH (comma separated):');
  ctx.session = { mode: 'await_search_terms' };
});

async function performSearch(ctx: MyContext, terms: string[]) {
  const uid = ctx.from?.id;
  const cid = ctx.chat?.id;
  if (uid == null || cid == null) return;

  const prefs = await ensurePrefs(uid);
  const pages = prefs.pages;

  const progressMsg = await ctx.reply(
    `Starting search (pages=${pages})…\nTerms: ${terms.join(', ')}`,
  );

  let lastEdit = 0;
  let last: Progress = { done: 0, total: 0, matches: 0 };

  const onProgress = async (p: Progress) => {
    last = p;
    const now = Date.now();
    if (now - lastEdit < 700) return;
    lastEdit = now;
    const text =
      `Progress: ${p.done}/${p.total} (${Math.floor((p.done / Math.max(1, p.total)) * 100)}%)\n` +
      `Pages: ${pages}\n` +
      `Terms: ${terms.join(', ')}`;
    await bot.telegram
      .editMessageText(progressMsg.chat.id, progressMsg.message_id, undefined, text)
      .catch(() => {});
  };

  try {
    const allFound = await scan(pages, 8, onProgress);
    const visible = filterSitesByTerms(allFound, terms);

    const header =
      `Checked: ${last.total}\n` +
      `Pages: ${pages}\n` +
      `Terms: ${terms.join(', ')}\n` +
      `Matches: ${visible.length}`;
    await bot.telegram
      .editMessageText(progressMsg.chat.id, progressMsg.message_id, undefined, header)
      .catch(async () => {
        await ctx.reply(header, { disable_web_page_preview: true });
      });

    if (visible.length === 0) {
      await ctx.reply('No matching items found.', { disable_web_page_preview: true });
      await showMainMenu(uid, cid);
      return;
    }

    const lines = visible.map((s) => `• ${s.url} — ${s.items.join(', ')}`);
    for (const part of chunkByLines(lines)) {
      await ctx.reply(part, { disable_web_page_preview: true });
    }
  } catch (e) {
    await ctx.reply(`Search failed: ${(e as Error).message}`, { disable_web_page_preview: true });
  }

  await showMainMenu(uid, cid);
}

/* ---------------------------- launch/stop -------------------------- */

export async function launchBot() {
  await bot.launch();
  logger.info('Bot launched');
}

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
