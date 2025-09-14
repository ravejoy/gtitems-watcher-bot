import type { PageScanner as IPageScanner } from '../../domain/page-scanner.js';
import type { Site } from '../../domain/site.js';
import type { ReviewLinkExtractor } from '../ports/review-link-extractor.js';
import type { ItemSource } from '../ports/item-source.js';
import type { ItemParser } from '../ports/item-parser.js';

export class PageScanner implements IPageScanner {
  constructor(
    private readonly links: ReviewLinkExtractor,
    private readonly source: ItemSource,
    private readonly parser: ItemParser,
  ) {}

  async scanPage(page: number): Promise<Site[]> {
    const sites = await this.links.extract(page);

    const seen = new Set<string>();
    const unique = sites.filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true)));

    const result: Site[] = [];
    for (const site of unique) {
      const fragment = await this.source.list(site.id);
      const items = this.parser.parse(fragment, site.id);
      result.push({ ...site, hasItems: items.length > 0, items });
    }
    return result;
  }

  async scanSiteReviews(site: Site): Promise<Site> {
    const fragment = await this.source.list(site.id);
    const items = this.parser.parse(fragment, site.id);
    return { ...site, hasItems: items.length > 0, items };
  }
}
