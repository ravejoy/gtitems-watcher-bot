import type { Item } from './item.js';

export interface Site {
  id: string;
  name: string;
  url: string;
  hasItems?: boolean;
  items?: Item[];
}
