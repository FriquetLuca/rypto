import { parseRoute, type Segment } from './parseRoute.js';

function bounds(segments: Segment[]): [min: number, max: number] {
  let min = 0;
  let max = 0;
  for (const s of segments) {
    if (s.type === 'optional') max++;
    else if (s.type === 'wildcard') {
      min++;
      max = Infinity;
    } else if (s.type === 'optionalWildcard') max = Infinity;
    else {
      min++;
      max++;
    }
  }
  return [min, max];
}

export interface Entry<T> {
  pattern: string;
  segments: Segment[];
  value: T;
  /** Fewest / most path segments this route can match. */
  min: number;
  max: number;
}

export function createEntry<T>(pattern: string, value: T): Entry<T> {
  const segments = parseRoute(pattern);
  const [min, max] = bounds(segments);
  return { pattern, segments, value, min, max };
}
