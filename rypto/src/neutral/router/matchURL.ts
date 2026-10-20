import { buildEntry } from './buildEntry.js';
import { createEntry } from './createEntry.js';
import { matchRoute } from './matchRoute.js';
import type { Match } from './router.js';

export const matchURL = (pattern: string, url: string): Match<string> | null =>
  matchRoute(url, buildEntry(createEntry(pattern, pattern)));
