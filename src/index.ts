import 'dotenv/config';
import { Telegraf } from 'telegraf';

const raw = process.env.BOT_TOKEN ?? '';
const token = raw.trim();

const tokenLooksOk = /^\d+:[\w-]{20,}$/.test(token); // базова перевірка формату

if (!token) {
  throw new Error('BOT_TOKEN is not defined in .env');
}
if (!tokenLooksOk) {
  throw new Error(
    'BOT_TOKEN looks invalid (format check failed). Remove quotes/spaces and try again.',
  );
}

const bot = new Telegraf(token);

bot.start((ctx) => ctx.reply('Hello! Bot is running.'));

bot.launch().then(() => {
  const masked = token.slice(0, 10) + '...' + token.slice(-6);
  console.log('Bot started with token:', masked);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
