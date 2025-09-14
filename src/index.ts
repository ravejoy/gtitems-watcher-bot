const main = async () => {
  console.log('gtitems-watcher-bot bootstrap OK');
};

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
