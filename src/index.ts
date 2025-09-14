import { PageScanner } from './core/services/site-scan-service.js';
import { HtmlReviewLinkExtractor } from './infra/html-review-link-extractor.js';
import { FragmentClient } from './infra/fragment-item-source.js';
import { XmlFragmentParser } from './infra/xml-fragment-item-parser.js';
import { createBot } from './bot/entry.js';
import { logger } from './lib/logger.js';

const main = async () => {
  const scanner = new PageScanner(
    new HtmlReviewLinkExtractor(),
    new FragmentClient(),
    new XmlFragmentParser(),
  );

  const bot = createBot(scanner);
  await bot.launch();
  logger.info('Telegram bot is up');

  const shutdown = async () => {
    logger.info('Shutting down…');
    await bot.stop();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
};

main().catch((err) => {
  logger.error(err, 'Fatal error');
  process.exit(1);
});
