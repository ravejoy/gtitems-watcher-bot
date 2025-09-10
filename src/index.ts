import 'dotenv/config';
import { SqliteStore } from './storage/sqliteStore.js';
import { UserPrefs } from './domain/types.js';

const store = new SqliteStore();

// test insert
const prefs: UserPrefs = {
  userId: 123,
  pages: 20,
  subscribed: true,
  filters: ['Нектар', 'Свиток'],
  updatedAt: Date.now(),
};

store.upsertPrefs(prefs);

console.log('Fetched:', store.getPrefs(123));
console.log('Subscribers:', store.allSubscribers());
