import type { UserPrefs } from '../domain/types.js';

export interface Store {
  upsertPrefs(p: UserPrefs): Promise<void>;
  getPrefs(userId: number): Promise<UserPrefs | undefined>;
  allSubscribers(): Promise<UserPrefs[]>;
}
