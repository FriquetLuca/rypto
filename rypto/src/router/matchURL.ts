import { buildEntry } from './buildEntry.js';
import { createEntry } from './createEntry.js';
import { matchRoute } from './matchRoute.js';
import type { Match } from './router.js';

export const matchURL = (
  url: string,
  targetURL: string
): Match<string> | null =>
  matchRoute(url, buildEntry(createEntry(targetURL, targetURL)));
