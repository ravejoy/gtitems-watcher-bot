import { describe, it, expect } from 'vitest';
import { HtmlReviewLinkExtractor } from '../src/infra/html-review-link-extractor.js';
import { HttpClient } from '../src/infra/http-client.js';

// Fake HttpClient to return fixture HTML
class FakeHttp extends HttpClient {
  private html: string;
  constructor(html: string) {
    super();
    this.html = html;
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

describe('HtmlReviewLinkExtractor', () => {
  it('extracts absolute review links and ids', async () => {
    const extractor = new HtmlReviewLinkExtractor(new FakeHttp(LIST_HTML));
    const sites = await extractor.extract(1);

    // two entries for 27190 (we dedupe by id in service, extractor returns both)
    const ids = sites.map((s) => s.id);
    expect(ids).toContain('27190');
    expect(ids).toContain('11');

    // URLs normalized (no hash)
    const u = sites.find((s) => s.id === '27190')!.url;
    expect(u.endsWith('/comm/27190/1.htm')).toBe(true);
    expect(u.includes('#')).toBe(false);
  });
});
