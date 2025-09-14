import { describe, it, expect, beforeEach } from 'vitest';
import type { ReviewLinkExtractor } from '../../src/core/ports/review-link-extractor.js';
import type { ItemSource } from '../../src/core/ports/item-source.js';
import type { ItemParser } from '../../src/core/ports/item-parser.js';
import type { Site } from '../../src/domain/site.js';
import type { Item } from '../../src/domain/item.js';
import { getEnv, resetEnv } from '../../src/lib/env.js';

class FakeLinks implements ReviewLinkExtractor {
  async extract(): Promise<Site[]> {
    return [
      { id: 'A', name: 'Site A', url: 'https://host/comm/A/1.htm' },
      { id: 'B', name: 'Site B', url: 'https://host/comm/B/1.htm#addcomm' },
      { id: 'B', name: 'Site B', url: 'https://host/comm/B/1.htm' },
      { id: 'C', name: 'Site C', url: 'https://host/comm/C/1.htm' },
    ];
  }
}
class FakeSource implements ItemSource {
  async list(siteId: string): Promise<string> {
    if (siteId === 'A') return '<item><items><alt>X</alt></items></item>';
    if (siteId === 'B') return '<item><items><alt>Y</alt></items></item>';
    return '';
  }
}
class FakeParser implements ItemParser {
  parse(fragment: string, siteId: string): Item[] {
    if (!fragment) return [];
    if (fragment.includes('<alt>X</alt>')) return [{ id: `${siteId}-1`, name: 'X' }];
    if (fragment.includes('<alt>Y</alt>')) return [{ id: `${siteId}-1`, name: 'Y' }];
    return [];
  }
}

beforeEach(() => {
  resetEnv();
  getEnv({
    BASE_URL: 'https://example.com',
    TELEGRAM_BOT_TOKEN: 'TEST',
    LOG_LEVEL: 'silent',
    NODE_ENV: 'test',
  });
});

describe('ScanService', () => {
  it('deduplicates by id and attaches parsed items', async () => {
    const { PageScanner } = await import('../../src/core/services/site-scan-service.js');

    const svc = new PageScanner(new FakeLinks(), new FakeSource(), new FakeParser());
    const result = await svc.scanPage(1);

    expect(result).toHaveLength(3);
    const byId = Object.fromEntries(result.map((s) => [s.id, s]));
    expect(byId['A']?.items).toEqual([{ id: 'A-1', name: 'X' }]);
    expect(byId['B']?.items).toEqual([{ id: 'B-1', name: 'Y' }]);
    expect(byId['C']?.items).toEqual([]);
  });
});
