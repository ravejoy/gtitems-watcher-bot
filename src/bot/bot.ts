import { Telegraf } from 'telegraf';
import type { PageScanner as IPageScanner } from '../domain/page-scanner.js';
import { logger } from '../lib/logger.js';
import { env } from '../lib/env.js';

function chunkText(input: string, limit = 4000): string[] {
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

export function createBot(scanner: IPageScanner) {
  const bot = new Telegraf(env.TELEGRAM_BOT_TOKEN);

  bot.start((ctx) =>
    ctx.reply(
      'Hi! Use /scan <pages> to scan rating pages (default 1). Returns review URLs that have items.',
    ),
  );

  bot.command('scan', async (ctx) => {
    try {
      const text = ctx.message?.text ?? '';
      const parts = text.trim().split(/\s+/);
      const pages = Math.min(Math.max(Number(parts[1] ?? '1') || 1, 1), 10);

      await ctx.reply(`Scanning ${pages} page(s)…`);

      const results: { url: string; items: string[] }[] = [];
      for (let p = 1; p <= pages; p++) {
        const sites = await scanner.scanPage(p);
        for (const s of sites) {
          const names = (s.items ?? []).map((i) => i.name);
          if (names.length > 0) results.push({ url: s.url, items: names });
        }
      }

      if (results.length === 0) {
        return ctx.reply('No sites with items found.');
      }

      const lines = results.map((r, i) => `${i + 1}. ${r.url} — ${r.items.join(', ')}`);
      const payload = lines.join('\n');

      for (const chunk of chunkText(payload)) {
        await ctx.reply(chunk);
      }
    } catch (err) {
      logger.error(err, 'scan failed');
      await ctx.reply('Scan failed.');
    }
  });

  bot.catch((err) => logger.error(err, 'bot error'));

  return bot;
}
