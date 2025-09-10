import { Markup } from 'telegraf';

export const buildMenu = (pages: number, subscribed: boolean) =>
  Markup.inlineKeyboard([
    [Markup.button.callback('Scan', 'scan'), Markup.button.callback('Search', 'search_names')],
    [
      Markup.button.callback(
        subscribed ? 'Subscription: ON (turn OFF)' : 'Subscription: OFF (turn ON)',
        'sub_toggle',
      ),
      Markup.button.callback('Subscription settings', 'sub_items_menu'),
    ],
    [
      Markup.button.callback(`Pages: ${pages} (set)`, 'set_pages'),
      Markup.button.callback('Status', 'status'),
    ],
  ]);

export const itemsMenu = Markup.inlineKeyboard([
  [
    Markup.button.callback('Add items', 'sub_add'),
    Markup.button.callback('Remove items', 'sub_remove'),
  ],
  [
    Markup.button.callback('Replace list', 'sub_replace'),
    Markup.button.callback('Show items', 'sub_show'),
  ],
  [Markup.button.callback('⬅ Back', 'back_main')],
]);
