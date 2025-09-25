import { getEnv } from './lib/env.js';
import { logger } from './lib/logger.js';

import { PageScanner } from './core/services/site-scanner.js';
import { HtmlReviewLinkExtractor } from './infra/review-link-extractor.js';
import { FragmentClient } from './infra/fragment-source.js';
import { XmlFragmentParser } from './infra/xml-fragment-item-parser.js';

import { createBot } from './bot/main.js';

async function bootstrap() {
  const env = getEnv();
  const links = new HtmlReviewLinkExtractor();
  const source = new FragmentClient();
  const parser = new XmlFragmentParser();

  const scanner = new PageScanner(links, source, parser, { concurrency: env.CONCURRENCY });

  const bot = createBot(scanner);
  await bot.launch();
  logger.info('gtitems-watcher-bot bootstrap OK');
}

bootstrap();
