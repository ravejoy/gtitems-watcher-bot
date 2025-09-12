import { Redis } from '@upstash/redis';
import type { Store } from './store.js';
import type { UserPrefs } from '../domain/types.js';
import { env } from '../env.ts';

export class RedisStore implements Store {
  private r: Redis;
  private idxKey = 'subs:index'; // set of userIds with subscribed=1

  constructor() {
    const url = env.UPSTASH_REDIS_REST_URL;
    const token = env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) throw new Error('Upstash Redis env vars are missing');
    this.r = new Redis({ url, token });
  }

  private key(userId: number) {
    return `prefs:${userId}`;
  }

  async upsertPrefs(p: UserPrefs): Promise<void> {
    await this.r.hset(this.key(p.userId), {
      userId: p.userId,
      pages: p.pages,
      subscribed: p.subscribed ? 1 : 0,
      filters: JSON.stringify(p.filters),
      updatedAt: p.updatedAt,
    });
    if (p.subscribed) await this.r.sadd(this.idxKey, String(p.userId));
    else await this.r.srem(this.idxKey, String(p.userId));
  }

  async getPrefs(userId: number): Promise<UserPrefs | undefined> {
    const h = (await this.r.hgetall<Record<string, string | number>>(this.key(userId))) || null;
    if (!h || Object.keys(h).length === 0) return undefined;
    return {
      userId: Number(h.userId),
      pages: Number(h.pages),
      subscribed: Number(h.subscribed) === 1,
      filters: safeParseFilters(String(h.filters ?? '[]')),
      updatedAt: Number(h.updatedAt),
    };
  }

  async allSubscribers(): Promise<UserPrefs[]> {
    const ids = (await this.r.smembers<string[]>(this.idxKey)) ?? [];
    if (ids.length === 0) return [];
    const results: UserPrefs[] = [];
    for (const id of ids) {
      const p = await this.getPrefs(Number(id));
      if (p?.subscribed) results.push(p);
    }
    return results;
  }
}

function safeParseFilters(s: string): string[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? (v as string[]) : [];
  } catch {
    return [];
  }
}
