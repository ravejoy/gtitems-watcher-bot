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

    $('a[href*="/comm/"]').each((_, el) => {
      const raw = $(el).attr('href');
      if (!raw) return;

      const abs = this.normalizeReviewUrl(this.toAbsoluteUrl(raw));
      const id = this.extractCommId(abs);
      if (!id) return;

      const name =
        $(el).text().trim() ||
        $(el)
          .closest('tr, .trow, .site, .block, div, li')
          .find('b, strong, .title, a[href^="http"]')
          .first()
          .text()
          .trim() ||
        `Site ${id}`;

      sites.push({ id, name, url: abs });
    });

    const seen = new Set<string>();
    return sites.filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true)));
  }

  async scanSiteReviews(site: Site): Promise<Site> {
    logger.debug({ site: site.url }, 'Scanning site reviews');
    const items = await this.fetchItemsList(site.id);
    return { ...site, hasItems: items.length > 0, items };
  }

  private async fetchItemsList(siteId: string) {
    // try with multiple "ver" values then without
    const candidates = [
      `${this.baseUrl}/cgi-bin/js/_item.cgi?act=list&ver=2048&site=${siteId}&page=1`,
      `${this.baseUrl}/cgi-bin/js/_item.cgi?act=list&ver=2040&site=${siteId}&page=1`,
      `${this.baseUrl}/cgi-bin/js/_item.cgi?act=list&ver=2030&site=${siteId}&page=1`,
      `${this.baseUrl}/cgi-bin/js/_item.cgi?act=list&site=${siteId}&page=1`,
    ];

    for (const u of candidates) {
      const body = await this.fetchCp1251(u);

      const parsed = this.parseItemsFromFragment(body, siteId);
      if (parsed.length > 0) return parsed;

      // last resort: quick peek to help debugging in logs (short preview only)
      logger.debug({ siteId, preview: body.slice(0, 120) }, 'No items parsed from fragment');
    }

    return [];
  }

  private parseItemsFromFragment(fragment: string, siteId: string) {
    const $ = cheerio.load(fragment, { xmlMode: true });

    const fromAlt = $('items > alt')
      .map((i, el) => {
        const name = $(el).text().trim();
        if (!name) return null;
        return { id: `${siteId}-${i + 1}`, name };
      })
      .get()
      .filter(Boolean) as { id: string; name: string }[];

    if (fromAlt.length) return fromAlt;

    const anyAlt = $('alt')
      .map((i, el) => {
        const name = $(el).text().trim();
        if (!name) return null;
        return { id: `${siteId}-${i + 1}`, name };
      })
      .get()
      .filter(Boolean) as { id: string; name: string }[];

    if (anyAlt.length) return anyAlt;

    const anchors = $(
      'a[href^="/cgi-bin/g.cgi?a="], a[href^="/cgi-bin/m.cgi?a="], a[href^="/cgi-bin/"]',
    );
    const fromAnchors = anchors
      .map((i, el) => {
        const a = $(el);
        const title = (a.attr('title') || '').trim();
        const text = a.text().trim();
        const name = title || text;
        if (!name) return null;
        return { id: `${siteId}-${i + 1}`, name };
      })
      .get()
      .filter(Boolean) as { id: string; name: string }[];

    if (fromAnchors.length) return fromAnchors;

    const matches = fragment.match(/item_get\([^)]*\)/g) || [];
    return matches.map((_, i) => ({ id: `${siteId}-${i + 1}`, name: 'Item' }));
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
        referer: `${this.baseUrl}/`, // some endpoints behave better with a referer
      },
      decompress: true,
    });
    return iconv.decode(res.rawBody, 'win1251');
  }

  private normalizeBaseUrl(u: string): string {
    return u.replace(/\/+$/, '');
  }

  private normalizeReviewUrl(u: string): string {
    return u.split('#')[0].replace(/([^:]\/)\/+/g, '$1');
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
