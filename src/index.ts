import { PageScanner } from './core/services/site-scan-service.js';
import { HtmlReviewLinkExtractor } from './infra/html-review-link-extractor.js';
import { FragmentClient } from './infra/fragment-client.js';
import { XmlFragmentParser } from './infra/xml-fragment-parser.js';
import { logger } from './lib/logger.js';

const main = async () => {
  const page = Number(process.env.SCAN_PAGE ?? '1');

  const scanner = new PageScanner(
    new HtmlReviewLinkExtractor(),
    new FragmentClient(),
    new XmlFragmentParser(),
  );

  const sites = await scanner.scanPage(page);

  sites.forEach((s, i) => {
    const items = (s.items ?? []).map((x) => x.name);
    console.log(`${i + 1}. ${s.url}${items.length ? ' — ' + items.join(', ') : ''}`);
  });

  logger.info({ total: sites.length }, 'Done');
};

main().catch((err) => {
  logger.error(err, 'Fatal error');
  process.exit(1);
});
