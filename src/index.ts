import { RpgtopPageScanner } from './infra/page-scanner.js';
import { logger } from './lib/logger.js';

const main = async () => {
  const page = Number(process.env.SCAN_PAGE ?? '1');

  const scanner = new RpgtopPageScanner();
  const sites = await scanner.scanPage(page);

  const results = [];
  for (const site of sites) {
    const detailed = await scanner.scanSiteReviews(site);
    results.push({
      url: detailed.url,
      items: (detailed.items ?? []).map((i) => i.name),
    });
  }

  results.forEach((r, i) => {
    const items = r.items.length ? ' — ' + r.items.join(', ') : '';
    console.log(`${i + 1}. ${r.url}${items}`);
  });

  logger.info({ total: results.length }, 'Done');
};

main().catch((err) => {
  logger.error(err, 'Fatal error');
  process.exit(1);
});
