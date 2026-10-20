import { buildEntries, type Index } from './buildEntries.js';
import type { Entry } from './createEntry.js';

export function buildEntry<T>(entry: Entry<T>): Index<T> {
  return buildEntries([entry]);
}
