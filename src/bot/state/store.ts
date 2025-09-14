type ChatSettings = { pages: number };

const settings = new Map<number, ChatSettings>();
const awaitingPagesInput = new Set<number>();
const awaitingSearchInput = new Set<number>();

export function getPages(chatId: number) {
  return settings.get(chatId)?.pages ?? 1;
}
export function setPages(chatId: number, n: number) {
  const pages = Math.max(1, Math.min(Math.trunc(n), 100));
  settings.set(chatId, { pages });
  return pages;
}

export function isAwaitingPages(id: number) {
  return awaitingPagesInput.has(id);
}
export function setAwaitingPages(id: number, v: boolean) {
  v ? awaitingPagesInput.add(id) : awaitingPagesInput.delete(id);
}

export function isAwaitingSearch(id: number) {
  return awaitingSearchInput.has(id);
}
export function setAwaitingSearch(id: number, v: boolean) {
  v ? awaitingSearchInput.add(id) : awaitingSearchInput.delete(id);
}

export function resetStore(): void {
  settings.clear();
  awaitingPagesInput.clear();
  awaitingSearchInput.clear();
}
