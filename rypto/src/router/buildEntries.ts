import { joinRoute } from './joinRoute.js';
import type { Entry } from './createEntry.js';
import type { Segment } from './parseRoute.js';
import { routeCompare } from './routeCompare.js';

type StaticSegment = Extract<Segment, { type: 'static' }>;

/**
 * Lookup structures built from the sorted routes. Each one only narrows the
 * candidates, the order of the sorted list still decides the winner:
 *
 * - `statics`: routes made only of static segments. Such a route beats every
 *   other route that matches the same URL, so an exact lookup is enough.
 * - `byFirst`: routes starting with a static segment, grouped by that segment.
 *   They all sort before the routes in `rest`, so they are tried first.
 * - `rest`: everything else (root, `[param]`, `[[optional]]`, wildcards first).
 */
export interface Index<T> {
  statics: Map<string, Entry<T>>;
  byFirst: Map<string, Entry<T>[]>;
  rest: Entry<T>[];
}

export function buildEntries<T>(entries: Entry<T>[]): Index<T> {
  const sorted = [...entries].sort((a, b) =>
    routeCompare(a.segments, b.segments)
  );
  const statics = new Map<string, Entry<T>>();
  const byFirst = new Map<string, Entry<T>[]>();
  const rest: Entry<T>[] = [];
  for (const entry of sorted) {
    const { segments } = entry;
    if (segments.every((s): s is StaticSegment => s.type === 'static')) {
      const key = joinRoute(segments.map((s) => s.value));
      if (!statics.has(key)) statics.set(key, entry); // first registered wins
    }
    const first = segments[0];
    if (first?.type === 'static') {
      const list = byFirst.get(first.value);
      if (list) list.push(entry);
      else byFirst.set(first.value, [entry]);
    } else {
      rest.push(entry);
    }
  }
  return { statics, byFirst, rest };
}
