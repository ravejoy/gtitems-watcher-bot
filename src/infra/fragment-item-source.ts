import * as cheerio from 'cheerio';
import type { ItemSource } from '../core/ports/item-source.js';
import { HttpClient } from './http-client.js';
import { getEnv } from '../lib/env.js';
import { logger } from '../lib/logger.js';

export class FragmentClient implements ItemSource {
  private readonly baseUrl: string;
  private readonly http: HttpClient;

  constructor(http?: HttpClient) {
    this.baseUrl = getEnv().BASE_URL.replace(/\/+$/, '');
    this.http = http ?? new HttpClient({ referer: `${this.baseUrl}/` });
  }

  async list(siteId: string): Promise<string> {
    const reviewsUrl = `${this.baseUrl}/comm/${siteId}/1.htm`;
    let html = '';
    try {
      html = await this.http.getCp1251(reviewsUrl);
    } catch (e) {
      logger.warn({ err: e, reviewsUrl }, 'failed to fetch review page');
      return '';
    }

    const $ = cheerio.load(html);
    const scriptSrc =
      $('script[src^="/js/item_"]').attr('src') || $('script[src^="/js/_item"]').attr('src') || '';

    const m = scriptSrc.match(/ver=(\d+)/);
    const ver = m ? m[1] : undefined;

    const urls = ver
      ? [
          `${this.baseUrl}/cgi-bin/js/_item.cgi?act=list&ver=${ver}&site=${siteId}&page=1`,
          `${this.baseUrl}/cgi-bin/js/_item.cgi?act=list&site=${siteId}&page=1`,
        ]
      : [`${this.baseUrl}/cgi-bin/js/_item.cgi?act=list&site=${siteId}&page=1`];

    for (const u of urls) {
      try {
        const body = await this.http.getCp1251(u);
        if (body) return body;
      } catch (e) {
        logger.warn({ err: e, url: u, siteId }, 'failed to fetch items fragment');
      }
    }

    return '';
  }
}
