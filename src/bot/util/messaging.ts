import { Telegraf } from 'telegraf';

export const noPreview = { link_preview_options: { is_disabled: true as const } };

export function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

export async function safeSend(bot: Telegraf, chatId: number, text: string, options?: any) {
  try {
    return await bot.telegram.sendMessage(chatId, text, options);
  } catch {
    return undefined;
  }
}

export async function safeEdit(
  bot: Telegraf,
  chatId: number,
  messageId: number,
  text: string,
  options?: any,
) {
  try {
    await bot.telegram.editMessageText(chatId, messageId, undefined, text, options);
  } catch {}
}
