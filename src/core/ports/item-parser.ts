import type { Item } from '../../domain/item.js';

export interface ItemParser {
  parse(fragment: string, siteId: string): Item[];
}
