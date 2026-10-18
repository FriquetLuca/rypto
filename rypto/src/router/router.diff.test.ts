import { Router } from './router.js';
import { Router as Baseline } from '../../bench/baseline.js';
import { expect, test } from 'vitest';

// The baseline is the straightforward implementation (sort once, scan every route in order).
// Whatever indexing the real Router does, it must return exactly what the baseline returns.

// seeded PRNG so a failure is reproducible
function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const randomPattern = (rand: () => number): string => {
  const pick = <V>(items: V[]) => items[Math.floor(rand() * items.length)];
  const length = Math.floor(rand() * 4); // 0..3 segments
  const segments: string[] = [];
  for (let i = 0; i < length; i++) {
    const last = i === length - 1;
    // names are unique per position so patterns are always valid
    const options = [
      'a',
      'b',
      'c',
      `[p${i}]`,
      `a-[m${i}]`,
      `[q${i}]-b`,
      `[p${i}].x`,
      `x-[m${i}]-y`,
    ];
    if (last) options.push('[[o]]', '[...w]', '[[...w]]', '[[o]]', '[...w]');
    segments.push(pick(options));
  }
  if (rand() < 0.15) segments.push('index'); // file-style routes
  return rand() < 0.5 ? `/${segments.join('/')}` : segments.join('/');
};

const randomUrl = (rand: () => number): string => {
  const pick = <V>(items: V[]) => items[Math.floor(rand() * items.length)];
  const pool = [
    'a',
    'b',
    'c',
    'a-1',
    'x-b',
    '1-b',
    '1.x',
    'x-2-y',
    'q',
    'index',
    '%61',
    'a%2Fb',
    '%E0%A4%A',
    'z',
  ];
  const length = Math.floor(rand() * 5); // 0..4 segments
  let url = '';
  for (let i = 0; i < length; i++)
    url += pick(['/', '/', '/', '//']) + pick(pool);
  if (length === 0 || rand() < 0.2) url += '/';
  if (rand() < 0.2) url += '?q=1&q=2';
  if (rand() < 0.2) url += '#top';
  return url;
};

test('differential > Router behaves exactly like the baseline on random tables', () => {
  const rand = mulberry32(20260418);
  let comparisons = 0;
  let matches = 0;

  for (let table = 0; table < 400; table++) {
    const patterns = Array.from({ length: 1 + Math.floor(rand() * 12) }, () =>
      randomPattern(rand)
    );
    const fast = new Router<number>();
    const reference = new Baseline<number>();
    patterns.forEach((p, i) => {
      fast.add(p, i);
      reference.add(p, i);
    });

    for (let n = 0; n < 60; n++) {
      const url = randomUrl(rand);
      const a = fast.match(url);
      const b = reference.match(url);
      const context = `patterns=[${patterns.join(', ')}] url='${url}'`;

      expect(a === null, context).toBe(b === null);
      if (a && b) {
        expect(a.value, context).toBe(b.value);
        expect(a.pattern, context).toBe(b.pattern);
        expect(a.params, context).toEqual(b.params);
        expect(a.pathname, context).toBe(b.pathname);
        expect(a.search, context).toBe(b.search);
        expect(a.hash, context).toBe(b.hash);
        expect(a.searchParams.toString(), context).toBe(
          b.searchParams.toString()
        );
        matches++;
      }
      comparisons++;
    }
  }

  // make sure the generator really exercises both outcomes
  expect(comparisons).toBe(24000);
  expect(matches).toBeGreaterThan(2000);
  expect(comparisons - matches).toBeGreaterThan(2000);
});

test('differential > adding routes after a match rebuilds the index', () => {
  const router = new Router<string>().add('/[a]', 'param');
  expect(router.match('/about')?.value).toBe('param');
  router.add('/about', 'static'); // would be ignored if the index were stale
  expect(router.match('/about')?.value).toBe('static');
  router.add('/[...rest]', 'rest');
  expect(router.match('/x/y')?.value).toBe('rest');
});

test('differential > searchParams is built lazily and stays stable per match', () => {
  const m = new Router<string>().add('/a', 'a').match('/a?x=1')!;
  expect(m.searchParams).toBe(m.searchParams); // same instance on repeated access
  expect(m.searchParams.get('x')).toBe('1');
});
