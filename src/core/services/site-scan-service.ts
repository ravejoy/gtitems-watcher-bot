import pLimit from 'p-limit';
import type { PageScanner as IPageScanner } from '../../domain/page-scanner.js';
import type { Site } from '../../domain/site.js';
import type { ReviewLinkExtractor } from '../ports/review-link-extractor.js';
import type { ItemSource } from '../ports/item-source.js';
import type { ItemParser } from '../ports/item-parser.js';
import { logger } from '../../lib/logger.js';

type Options = { concurrency?: number };

export class PageScanner implements IPageScanner {
  constructor(
    private readonly links: ReviewLinkExtractor,
    private readonly source: ItemSource,
    private readonly parser: ItemParser,
    private readonly options: Options = {},
  ) {}

  async scanPage(page: number): Promise<Site[]> {
    const sites = await this.links.extract(page);

    const seenIds = new Set<string>();
    const unique = sites.filter((s) => (seenIds.has(s.id) ? false : (seenIds.add(s.id), true)));

    const limit = pLimit(this.options.concurrency ?? 8);

    const enriched = await Promise.all(
      unique.map((site) =>
        limit(async () => {
          try {
            const fragment = await this.source.list(site.id);
            const items = this.parser.parse(fragment, site.id);
            return { ...site, hasItems: items.length > 0, items };
          } catch (e) {
            logger.warn({ err: e, site: site.id }, 'failed site scan');
            return { ...site, hasItems: false, items: [] };
          }
        }),
      ),
    );

    return enriched;
  }

  async scanSiteReviews(site: Site): Promise<Site> {
    try {
      const fragment = await this.source.list(site.id);
      const items = this.parser.parse(fragment, site.id);
      return { ...site, hasItems: items.length > 0, items };
    } catch (e) {
      logger.warn({ err: e, site: site.id }, 'failed site scan (single)');
      return { ...site, hasItems: false, items: [] };
    }
  }
}
