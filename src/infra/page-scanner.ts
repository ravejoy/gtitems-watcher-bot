import got from 'got';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';

import type { PageScanner } from '../domain/page-scanner.js';
import type { Site } from '../domain/site.js';
import { env } from '../lib/env.js';
import { logger } from '../lib/logger.js';

export class RpgtopPageScanner implements PageScanner {
  private baseUrl: string;

  constructor() {
    this.baseUrl = env.BASE_URL;
  }

  async scanPage(page: number): Promise<Site[]> {
    const url = page === 1 ? `${this.baseUrl}/` : `${this.baseUrl}/p${page}.html`;
    logger.debug({ url }, 'Scanning page');

    const html = await this.fetchHtml(url);
    const $ = cheerio.load(html);

    const sites: Site[] = [];

    $('a[href*="otzyvy"]').each((_, el) => {
      const anchor = $(el);
      const href = anchor.attr('href');
      const name = anchor.text().trim();

      if (!href) return;

      const site: Site = {
        id: this.extractSiteId(href),
        name,
        url: new URL(href, this.baseUrl).toString(),
      };

      sites.push(site);
    });

    return sites;
  }

  async scanSiteReviews(site: Site): Promise<Site> {
    logger.debug({ site: site.url }, 'Scanning site reviews');

    const html = await this.fetchHtml(site.url);
    const $ = cheerio.load(html);

    const items = $('.item, .items')
      .map((_, el) => {
        const id = $(el).attr('id') ?? `item-${Math.random().toString(36).slice(2)}`;
        const name = $(el).find('.item-name').text().trim() || 'Unknown item';
        const description = $(el).find('.item-desc').text().trim() || undefined;

        return { id, name, description };
      })
      .get();

    return { ...site, hasItems: items.length > 0, items };
  }

  private async fetchHtml(url: string): Promise<string> {
    const res = await got(url, { responseType: 'buffer', retry: { limit: 2 } });
    return iconv.decode(res.rawBody, 'win1251');
  }

  private extractSiteId(href: string): string {
    const match = href.match(/\/(\d+)-/);
    return match ? match[1] : `site-${Math.random().toString(36).slice(2)}`;
  }
}
