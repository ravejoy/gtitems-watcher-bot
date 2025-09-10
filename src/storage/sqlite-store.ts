// src/storage/sqlite-store.ts
import Database from 'better-sqlite3';

import type { UserPrefs } from '../domain/types.js';

import type { Store } from './store.js';

type PrefsRow = {
  userId: number;
  pages: number;
  subscribed: number; // stored as 0/1
  filters: string; // JSON string
  updatedAt: number;
};

export class SqliteStore implements Store {
  private db: Database.Database;

  constructor(path = 'data.db') {
    this.db = new Database(path);
    this.db
      .prepare(
        `CREATE TABLE IF NOT EXISTS prefs (
          userId INTEGER PRIMARY KEY,
          pages INTEGER NOT NULL,
          subscribed INTEGER NOT NULL,
          filters TEXT NOT NULL,
          updatedAt INTEGER NOT NULL
        )`,
      )
      .run();
  }

  upsertPrefs(p: UserPrefs): void {
    this.db
      .prepare(
        `INSERT INTO prefs(userId, pages, subscribed, filters, updatedAt)
         VALUES(@userId, @pages, @subscribed, @filters, @updatedAt)
         ON CONFLICT(userId) DO UPDATE SET
           pages=excluded.pages,
           subscribed=excluded.subscribed,
           filters=excluded.filters,
           updatedAt=excluded.updatedAt`,
      )
      .run({
        ...p,
        subscribed: p.subscribed ? 1 : 0,
        filters: JSON.stringify(p.filters),
      });
  }

  getPrefs(userId: number): UserPrefs | undefined {
    // Explicit cast fixes TS seeing {} for .get()
    const row = this.db.prepare(`SELECT * FROM prefs WHERE userId = ?`).get(userId) as
      | PrefsRow
      | undefined;

    if (!row) return undefined;

    return {
      userId: row.userId,
      pages: row.pages,
      subscribed: !!row.subscribed,
      filters: safeParseFilters(row.filters),
      updatedAt: row.updatedAt,
    };
  }

  allSubscribers(): UserPrefs[] {
    const rows = this.db.prepare(`SELECT * FROM prefs WHERE subscribed = 1`).all() as PrefsRow[];

    return rows.map((r) => ({
      userId: r.userId,
      pages: r.pages,
      subscribed: !!r.subscribed,
      filters: safeParseFilters(r.filters),
      updatedAt: r.updatedAt,
    }));
  }
}

function safeParseFilters(json: string): string[] {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? (v as string[]) : [];
  } catch {
    return [];
  }
}
