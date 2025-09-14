import { describe, it, expect, beforeEach } from 'vitest';
import { HttpClient } from '../src/infra/http-client.js';
import { getEnv, resetEnv } from '../src/lib/env.js';

// Fake HttpClient to return fixture HTML
class FakeHttp extends HttpClient {
  constructor(private html: string) {
    super();
  }
  async getCp1251(): Promise<string> {
    return this.html;
  }
}

const LIST_HTML = `
<html><body>
  <a href="/comm/27190/1.htm">Reviews</a>
  <a href="/comm/27190/1.htm#addcomm">Reviews (dup)</a>
  <a href="/comm/11/1.htm">Reviews 11</a>
</body></html>`;

beforeEach(() => {
  resetEnv();
  getEnv({
    BASE_URL: 'https://example.com',
    TELEGRAM_BOT_TOKEN: 'TEST',
    LOG_LEVEL: 'silent',
    NODE_ENV: 'test',
  });
});

describe('HtmlReviewLinkExtractor', () => {
  it('extracts absolute review links and ids', async () => {
    const { HtmlReviewLinkExtractor } = await import('../src/infra/html-review-link-extractor.js');

    const extractor = new HtmlReviewLinkExtractor(new FakeHttp(LIST_HTML));
    const sites = await extractor.extract(1);

    const ids = sites.map((s) => s.id);
    expect(ids).toContain('27190');
    expect(ids).toContain('11');

    const u = sites.find((s) => s.id === '27190')!.url;
    expect(u.endsWith('/comm/27190/1.htm')).toBe(true);
    expect(u.includes('#')).toBe(false);
  });
});
