import { logger } from './lib/logger.js';
import { env } from './lib/env.js';

const main = async () => {
  logger.info(`gtitems-watcher-bot bootstrap OK [env=${env.NODE_ENV}]`);
};

main().catch((err) => {
  logger.error(err, 'Fatal error');
  process.exit(1);
});
