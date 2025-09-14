import * as cheerio from 'cheerio';
import type { ItemParser } from '../core/ports/item-parser.js';
import type { Item } from '../domain/item.js';

export class XmlFragmentParser implements ItemParser {
  parse(fragment: string, siteId: string): Item[] {
    if (!fragment) return [];

    const $ = cheerio.load(fragment, { xmlMode: true });

    const fromAlt = $('items > alt')
      .map((i, el) => {
        const name = $(el).text().trim();
        if (!name) return null;
        return { id: `${siteId}-${i + 1}`, name };
      })
      .get()
      .filter(Boolean) as Item[];

    if (fromAlt.length) return fromAlt;

    const anyAlt = $('alt')
      .map((i, el) => {
        const name = $(el).text().trim();
        if (!name) return null;
        return { id: `${siteId}-${i + 1}`, name };
      })
      .get()
      .filter(Boolean) as Item[];

    if (anyAlt.length) return anyAlt;

    const matches = fragment.match(/item_get\([^)]*\)/g) || [];
    return matches.map((_, i) => ({ id: `${siteId}-${i + 1}`, name: 'Item' }));
  }
}
