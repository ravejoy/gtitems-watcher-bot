import { UserPrefs } from '../domain/types.js';

export interface Store {
  upsertPrefs(p: UserPrefs): void;
  getPrefs(userId: number): UserPrefs | undefined;
  allSubscribers(): UserPrefs[];
}
