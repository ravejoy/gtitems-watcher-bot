import { logger } from './lib/logger.js';

const main = async () => {
  logger.info('gtitems-watcher-bot bootstrap OK');
};

main().catch((err) => {
  logger.error(err, 'Fatal error');
  process.exit(1);
});
