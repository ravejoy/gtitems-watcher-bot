import { PageScanner } from './core/services/site-scan-service.js';
import { HtmlReviewLinkExtractor } from './infra/html-review-link-extractor.js';
import { FragmentClient } from './infra/fragment-item-source.js';
import { XmlFragmentParser } from './infra/xml-fragment-item-parser.js';
import { logger } from './lib/logger.js';

const main = async () => {
  const page = Number(process.env.SCAN_PAGE ?? '1');

  const scanner = new PageScanner(
    new HtmlReviewLinkExtractor(),
    new FragmentClient(),
    new XmlFragmentParser(),
  );

  const sites = await scanner.scanPage(page);

  // keep only sites that have at least one item
  const withItems = sites.filter((s) => (s.items?.length ?? 0) > 0);

  withItems.forEach((s, i) => {
    const items = (s.items ?? []).map((x) => x.name);
    console.log(`${i + 1}. ${s.url} — ${items.join(', ')}`);
  });

  logger.info({ total: withItems.length }, 'Done');
};

main().catch((err) => {
  logger.error(err, 'Fatal error');
  process.exit(1);
});
