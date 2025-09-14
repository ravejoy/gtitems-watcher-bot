import { describe, it, expect } from 'vitest';
import { FragmentClient } from '../src/infra/fragment-item-source.js';
import { HttpClient } from '../src/infra/http-client.js';

class SequenceHttp extends HttpClient {
  private responses: string[];
  constructor(responses: string[]) {
    super();
    this.responses = responses;
  }
  async getCp1251(url: string): Promise<string> {
    // pop from front to simulate sequential calls: review page then list
    return this.responses.shift() ?? '';
  }
}

// Review page with <script src="/js/item_123.js?ver=2040">
const REVIEW_HTML = `
<html><head>
<script src="/js/item_123.js?ver=2040"></script>
</head><body></body></html>
`;

// List fragment XML
const FRAGMENT_XML = `<?xml version='1.0' encoding='windows-1251'?>
<item><items><alt>Test Item</alt></items></item>`;

describe('FragmentClient', () => {
  it('fetches review page, extracts ver, then returns items fragment', async () => {
    const http = new SequenceHttp([REVIEW_HTML, FRAGMENT_XML]);
    const client = new FragmentClient(http);

    const body = await client.list('26742');
    expect(body.includes('<alt>Test Item</alt>')).toBe(true);
  });
});
