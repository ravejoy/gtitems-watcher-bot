import { Telegraf, type Context } from 'telegraf';
import type { UserPrefs } from './domain/types.js';
import { buildMenu, itemsMenu } from './keyboards.js';
import { RedisStore } from './storage/redis-store.js';

const token = process.env.BOT_TOKEN;
if (!token) throw new Error('BOT_TOKEN is not defined');

const DEFAULT_PAGES = Number(process.env.DEFAULT_PAGES ?? 20);

export const bot = new Telegraf(token);
const store = new RedisStore();

type Mode = 'set_pages' | 'sub_add' | 'sub_remove' | 'sub_replace';
const states = new Map<number, { mode?: Mode }>();

bot.start(async (ctx) => {
  const userId = ctx.from!.id;
  const prefs = await ensurePrefs(userId);
  await ctx.reply('Hello! Choose an action:', buildMenu(prefs.pages, prefs.subscribed));
});

bot.action('status', async (ctx) => {
  await ctx.answerCbQuery();
  const p = await ensurePrefs(ctx.from!.id);
  const filters = p.filters.length ? p.filters.join(', ') : '—';
  await ctx.reply(
    `Status:
- Pages: ${p.pages}
- Subscribed: ${p.subscribed}
- Filters: ${filters}`,
  );
  await sendMainMenu(ctx);
});

bot.action('sub_toggle', async (ctx) => {
  await ctx.answerCbQuery();
  const p = await ensurePrefs(ctx.from!.id);
  const next: UserPrefs = { ...p, subscribed: !p.subscribed, updatedAt: Date.now() };
  await store.upsertPrefs(next);

  // Update the inline keyboard on the previous message (best effort)
  await ctx
    .editMessageReplyMarkup(buildMenu(next.pages, next.subscribed).reply_markup)
    .catch(() => {});

  await ctx.reply(`Subscription ${next.subscribed ? 'ENABLED' : 'DISABLED'}.`);
  await sendMainMenu(ctx);
});

bot.action('set_pages', async (ctx) => {
  await ctx.answerCbQuery();
  states.set(ctx.from!.id, { mode: 'set_pages' });
  await ctx.reply('How many pages to scan? (1..500)');
});

// ----- Subscription items submenu -----
bot.action('sub_items_menu', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('Manage subscription filters:', itemsMenu);
});

bot.action('back_main', async (ctx) => {
  await ctx.answerCbQuery();
  await sendMainMenu(ctx);
});

bot.action('sub_add', async (ctx) => {
  await ctx.answerCbQuery();
  states.set(ctx.from!.id, { mode: 'sub_add' });
  await ctx.reply('Enter item names to ADD (comma separated):');
});

bot.action('sub_remove', async (ctx) => {
  await ctx.answerCbQuery();
  states.set(ctx.from!.id, { mode: 'sub_remove' });
  await ctx.reply('Enter item names to REMOVE (comma separated):');
});

bot.action('sub_replace', async (ctx) => {
  await ctx.answerCbQuery();
  states.set(ctx.from!.id, { mode: 'sub_replace' });
  await ctx.reply('Enter FULL new list of items (comma separated):');
});

bot.action('sub_show', async (ctx) => {
  await ctx.answerCbQuery();
  const p = await ensurePrefs(ctx.from!.id);
  const filters = p.filters.length ? p.filters.join(', ') : '—';
  await ctx.reply(`Current filters: ${filters}`);
  await sendMainMenu(ctx);
});

// ----- Text handler for input flows -----
bot.on('text', async (ctx) => {
  const s = states.get(ctx.from!.id);
  if (!s?.mode) return;

  const text = ctx.message.text.trim();

  if (s.mode === 'set_pages') {
    const n = Number(text);
    if (!Number.isInteger(n) || n < 1 || n > 500) {
      await ctx.reply('Please send a valid number between 1 and 500.');
      return;
    }
    const p = await ensurePrefs(ctx.from!.id);
    const next: UserPrefs = { ...p, pages: n, updatedAt: Date.now() };
    await store.upsertPrefs(next);
    states.delete(ctx.from!.id);
    await ctx.reply(`Pages set to ${n}.`);
    await sendMainMenu(ctx);
    return;
  }

  const items = text
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

  if (s.mode === 'sub_add') {
    const p = await ensurePrefs(ctx.from!.id);
    const next: UserPrefs = {
      ...p,
      filters: [...new Set([...p.filters, ...items])],
      updatedAt: Date.now(),
    };
    await store.upsertPrefs(next);
    states.delete(ctx.from!.id);
    await ctx.reply(`Added: ${items.join(', ')}`);
    await sendMainMenu(ctx);
    return;
  }

  if (s.mode === 'sub_remove') {
    const p = await ensurePrefs(ctx.from!.id);
    const next: UserPrefs = {
      ...p,
      filters: p.filters.filter((f) => !items.includes(f)),
      updatedAt: Date.now(),
    };
    await store.upsertPrefs(next);
    states.delete(ctx.from!.id);
    await ctx.reply(`Removed: ${items.join(', ')}`);
    await sendMainMenu(ctx);
    return;
  }

  if (s.mode === 'sub_replace') {
    const p = await ensurePrefs(ctx.from!.id);
    const next: UserPrefs = { ...p, filters: items, updatedAt: Date.now() };
    await store.upsertPrefs(next);
    states.delete(ctx.from!.id);
    await ctx.reply(`Replaced list with: ${items.join(', ')}`);
    await sendMainMenu(ctx);
  }
});

// placeholders for features we’ll add next
bot.action('scan', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('Scan is not implemented yet.');
  await sendMainMenu(ctx);
});

bot.action('search_names', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('Search is not implemented yet.');
  await sendMainMenu(ctx);
});

export async function launchBot() {
  await bot.launch();
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

async function ensurePrefs(userId: number): Promise<UserPrefs> {
  const existing = await store.getPrefs(userId);
  if (existing) return existing;
  const def: UserPrefs = {
    userId,
    pages: DEFAULT_PAGES,
    subscribed: false,
    filters: [],
    updatedAt: Date.now(),
  };
  await store.upsertPrefs(def);
  return def;
}

async function sendMainMenu(ctx: Context) {
  const userId = ctx.from?.id;
  if (!userId) return;
  const p = await ensurePrefs(userId);
  await ctx.reply('Choose an action:', buildMenu(p.pages, p.subscribed));
}
