import { parseRoute, type Segment } from './parseRoute.js';

export interface Entry<T> {
  pattern: string;
  segments: Segment[];
  value: T;
  min: number;
  max: number;
}

export function createEntry<T>(pattern: string, value: T): Entry<T> {
  const segments = parseRoute(pattern);
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
  return { pattern, segments, value, min, max };
}
