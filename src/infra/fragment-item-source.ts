import * as cheerio from 'cheerio';
import type { ItemSource } from '../core/ports/item-source.js';
import { HttpClient } from './http-client.js';
import { env } from '../lib/env.js';

export class FragmentClient implements ItemSource {
  private readonly baseUrl: string;
  private readonly http: HttpClient;

  constructor() {
    this.baseUrl = env.BASE_URL.replace(/\/+$/, '');
    this.http = new HttpClient({ referer: `${this.baseUrl}/` });
  }

  async list(siteId: string): Promise<string> {
    // resolve ver from the reviews page <script src="/js/item_XXXX.js?ver=NNNN">
    const reviewsUrl = `${this.baseUrl}/comm/${siteId}/1.htm`;
    const html = await this.http.getCp1251(reviewsUrl);
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
      const body = await this.http.getCp1251(u);
      if (body && body.length > 0) return body;
    }
    return '';
  }
}
