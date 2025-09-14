import got from 'got';
import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';

import type { PageScanner } from '../domain/page-scanner.js';
import type { Site } from '../domain/site.js';
import { env } from '../lib/env.js';
import { logger } from '../lib/logger.js';

export class RpgtopPageScanner implements PageScanner {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = this.normalizeBaseUrl(env.BASE_URL);
  }

  async scanPage(page: number): Promise<Site[]> {
    const url = page === 1 ? `${this.baseUrl}/` : `${this.baseUrl}/p${page}.html`;
    logger.debug({ url }, 'Scanning page');

    const html = await this.fetchCp1251(url);
    const $ = cheerio.load(html);

    const sites: Site[] = [];

    // Review links look like /comm/<id>/<n>.htm
    $('a[href*="/comm/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      const abs = this.toAbsoluteUrl(href);
      const id = this.extractCommId(abs);
      if (!id) return;

      const container = $(el).closest('tr, .trow, .site, .block, div, li');
      const nameCandidate =
        container.find('a[href^="http"]').first().text().trim() ||
        container.find('b, strong, .title').first().text().trim() ||
        $(el).text().trim();

      const name = nameCandidate || `Site ${id}`;

      sites.push({ id, name, url: abs });
    });

    return sites;
  }

  async scanSiteReviews(site: Site): Promise<Site> {
    logger.debug({ site: site.url }, 'Scanning site reviews');

    const itemCount = await this.fetchItemsCount(site.id);

    return {
      ...site,
      hasItems: itemCount > 0,
      items: itemCount
        ? Array.from({ length: itemCount }, (_, i) => ({
            id: `${site.id}-${i + 1}`,
            name: 'Item',
          }))
        : [],
    };
  }

  private async fetchItemsCount(siteId: string): Promise<number> {
    const url = `${this.baseUrl}/cgi-bin/js/_item.cgi?act=list&site=${siteId}&page=1`;
    const body = await this.fetchCp1251(url);

    const $ = cheerio.load(body);

    const anchors = $('a[href^="/cgi-bin/"][href*=".cgi?a="]');
    if (anchors.length > 0) return anchors.length;

    const raw = body;
    const jsMatches = raw.match(/item_get\(/g);
    if (jsMatches) return jsMatches.length;

    return 0;
  }

  private async fetchCp1251(url: string): Promise<string> {
    const res = await got(url, {
      responseType: 'buffer',
      timeout: { request: 10000 },
      retry: { limit: 2 },
      headers: {
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-language': 'ru,en;q=0.9',
      },
      decompress: true,
    });
    return iconv.decode(res.rawBody, 'win1251');
  }

  private normalizeBaseUrl(u: string): string {
    return u.replace(/\/+$/, '');
  }

  private toAbsoluteUrl(href: string): string {
    try {
      return new URL(href, `${this.baseUrl}/`).toString();
    } catch {
      return `${this.baseUrl}/`;
    }
  }

  private extractCommId(url: string): string | null {
    const m = url.match(/\/comm\/(\d+)\//);
    return m ? m[1] : null;
  }
}
