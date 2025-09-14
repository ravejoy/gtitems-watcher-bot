import { describe, it, expect, beforeEach } from 'vitest';
import { HttpClient } from '../../src/infra/http-client.js';
import { getEnv, resetEnv } from '../../src/lib/env.js';

class SequenceHttp extends HttpClient {
  constructor(private responses: string[]) {
    super();
  }
  async getCp1251(): Promise<string> {
    return this.responses.shift() ?? '';
  }
}

// Review page with ver param
const REVIEW_HTML = `
<html><head>
<script src="/js/item_123.js?ver=2040"></script>
</head><body></body></html>
`;

// List fragment XML
const FRAGMENT_XML = `<?xml version='1.0' encoding='windows-1251'?>
<item><items><alt>Test Item</alt></items></item>`;

beforeEach(() => {
  resetEnv();
  getEnv({
    BASE_URL: 'https://example.com',
    TELEGRAM_BOT_TOKEN: 'TEST',
    LOG_LEVEL: 'silent',
    NODE_ENV: 'test',
  });
});

describe('FragmentClient', () => {
  it('fetches review page, extracts ver, then returns items fragment', async () => {
    const { FragmentClient } = await import('../../src/infra/fragment-source.js');

    const http = new SequenceHttp([REVIEW_HTML, FRAGMENT_XML]);
    const client = new FragmentClient(http);

    const body = await client.list('26742');
    expect(body.includes('<alt>Test Item</alt>')).toBe(true);
  });
});
