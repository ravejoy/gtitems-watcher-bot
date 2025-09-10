import { Telegraf } from 'telegraf';

import { logger } from './services/logger.js';

const token = process.env.BOT_TOKEN;

if (!token) {
  throw new Error('BOT_TOKEN is not defined in .env');
}

export const bot = new Telegraf(token);

bot.start((ctx) => ctx.reply('Hello! Bot is running.'));

// just a test action to check keyboards later
bot.action('status', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.reply('Status command placeholder');
});

export async function launchBot() {
  await bot.launch();
  logger.info('Bot started');
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
