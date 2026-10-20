import type { Segment } from './parseRoute.js';

const rank = (s: Segment): number => {
  switch (s.type) {
    case 'static':
      return 0;
    case 'dynamic':
      return s.parts.length === 1 ? 2 : 1; // `[a]` vs `[a]-[b]`
    case 'optional':
      return 3;
    case 'wildcard':
      return 4;
    case 'optionalWildcard':
      return 5;
  }
};

const staticLength = (s: Segment): number =>
  s.type === 'dynamic'
    ? s.parts.reduce((n, p) => n + (p.kind === 'text' ? p.value.length : 0), 0)
    : 0;

export function routeCompare(a: Segment[], b: Segment[]): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const d = rank(a[i]) - rank(b[i]);
    if (d !== 0) return d;
    const s = staticLength(b[i]) - staticLength(a[i]);
    if (s !== 0) return s;
  }
  return a.length - b.length;
}
