import * as cheerio from 'cheerio';
import type { ReviewLinkExtractor } from '../core/ports/review-link-extractor.js';
import type { Site } from '../domain/site.js';
import { HttpClient } from './http-client.js';
import { getEnv } from '../lib/env.js';
import { logger } from '../lib/logger.js';

export class HtmlReviewLinkExtractor implements ReviewLinkExtractor {
  private readonly baseUrl: string;
  private readonly http: HttpClient;

  constructor(http?: HttpClient) {
    this.baseUrl = getEnv().BASE_URL.replace(/\/+$/, '');
    this.http = http ?? new HttpClient();
  }

  async extract(page: number): Promise<Site[]> {
    const url = page === 1 ? `${this.baseUrl}/` : `${this.baseUrl}/p${page}.html`;
    let html = '';
    try {
      html = await this.http.getCp1251(url);
    } catch (e) {
      logger.warn({ err: e, url }, 'failed to fetch rating page');
      return [];
    }

    const $ = cheerio.load(html);
    const sites: Site[] = [];

    $('a[href*="/comm/"]').each((_, el) => {
      const raw = $(el).attr('href');
      if (!raw) return;

      const abs = this.normalize(this.abs(raw));
      const id = this.extractId(abs);
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

    return sites;
  }

  private abs(href: string): string {
    try {
      return new URL(href, `${this.baseUrl}/`).toString();
    } catch {
      return `${this.baseUrl}/`;
    }
  }

  private normalize(u: string): string {
    return u.split('#')[0].replace(/([^:]\/)\/+/g, '$1');
  }

  private extractId(url: string): string | null {
    const m = url.match(/\/comm\/(\d+)\//);
    return m ? m[1] : null;
  }
}
