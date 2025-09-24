import { Markup } from 'telegraf';
import { getPages } from '../state/store.js';

export function mainMenu(chatId: number) {
  const pages = getPages(chatId);
  return Markup.inlineKeyboard([
    [Markup.button.callback('Scan', 'act_scan'), Markup.button.callback('Search', 'act_search')],
    [Markup.button.callback(`Pages: ${pages} (set)`, 'act_set_pages')],
  ]);
}
