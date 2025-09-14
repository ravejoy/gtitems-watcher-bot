import { RpgtopPageScanner } from './infra/page-scanner.js';
import { logger } from './lib/logger.js';

const main = async () => {
  const scanner = new RpgtopPageScanner();
  const sites = await scanner.scanPage(1);

  logger.info({ count: sites.length }, 'Sites found on page 1');

  if (sites[0]) {
    const detailed = await scanner.scanSiteReviews(sites[0]);
    logger.info({ site: detailed.name, items: detailed.items?.length }, 'First site scan');
  }
};

main().catch((err) => {
  logger.error(err, 'Fatal error');
  process.exit(1);
});
