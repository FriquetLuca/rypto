// Run with: npx tsx bench/run.ts
import { Bench, type Task } from 'tinybench';
import { Router } from '../dist/index.js';
import { Router as Baseline } from './baseline.js';
import { Router as StaticBoost } from './staticBoost.js';

interface Impl {
  add(pattern: string, value: string): unknown;
  match(url: string): unknown;
}
const impls: [string, () => Impl][] = [
  ['baseline', () => new Baseline<string>()],
  ['staticBoost', () => new StaticBoost<string>()],
  ['paramBoost', () => new Router<string>()],
];

// 8 routes: a small site
const small = [
  '/',
  '/about',
  '/blog',
  '/blog/[slug]',
  '/docs/[...path]',
  '/files/[name].[ext]',
  '/[lang]',
  '/[lang]/blog/[slug]',
];

// 606 routes: 200 sections x (list, detail, edit) + locale routes + catch-alls
const large: string[] = [];
for (let i = 0; i < 200; i++)
  large.push(`/s${i}`, `/s${i}/[id]`, `/s${i}/[id]/edit`);
large.push(
  '/docs/[...path]',
  '/[lang]',
  '/[lang]/blog',
  '/[lang]/blog/[slug]',
  '/[lang]/[...rest]',
  '/[[...all]]'
);

const scenarios: [string, string[], string][] = [
  ['small > static hit', small, '/about'],
  ['small > [param] hit', small, '/blog/hello'],
  ['small > [...wildcard] hit', small, '/docs/a/b/c'],
  ['small > mixed [name].[ext] hit', small, '/files/report.pdf'],
  ['small > /[lang]/blog/[slug] hit', small, '/en/blog/x'],
  ['small > miss', small, '/nope/a/b'],

  ['large > static hit, first section', large, '/s0'],
  ['large > static hit, last section', large, '/s199'],
  ['large > [id] hit, late section', large, '/s150/42'],
  ['large > [id]/edit hit, late section', large, '/s150/42/edit'],
  ['large > /[lang]/blog/[slug] hit', large, '/en/blog/x'],
  ['large > falls to [[...all]] (worst case)', large, '/zzz/a/b'],
  [
    'large > query + hash + %-encoding',
    large,
    '/s10/hello%20world?x=1&y=2#top',
  ],
];

function stats(t: Task) {
  const r = t.result;
  if (!r || !('throughput' in r))
    throw new Error(`benchmark '${t.name}' did not complete`);
  return r;
}

const only = process.argv[2]; // optional substring filter, e.g. `large`
const sink: { v: unknown } = { v: undefined };
const rows: string[][] = [];

for (const [name, patterns, url] of scenarios) {
  if (only && !name.includes(only)) continue;
  const bench = new Bench({ time: 400, warmupTime: 150 });
  for (const [label, make] of impls) {
    const router = make();
    for (const p of patterns) router.add(p, p);
    router.match('/'); // let implementations that build lazily do it before timing
    bench.add(label, () => {
      sink.v = router.match(url);
    });
  }
  await bench.run();
  const [a, b, c] = bench.tasks.map((t) => stats(t).throughput.mean);
  rows.push([
    name,
    fmt(a),
    fmt(b),
    fmt(c),
    `${(c / b).toFixed(2)}x`,
    `${(c / a).toFixed(2)}x`,
  ]);
}

// building a table is a separate kind of measurement (ms per build, not ops/s)
if (!only || 'build'.includes(only)) {
  const bench = new Bench({ time: 400, warmupTime: 150 });
  for (const [label, make] of impls) {
    bench.add(label, () => {
      const router = make();
      for (const p of large) router.add(p, p);
      sink.v = router.match('/');
    });
  }
  await bench.run();
  const [a, b, c] = bench.tasks.map((t) => stats(t).latency.mean);
  rows.push([
    'build 606 routes + first match (ms)',
    a.toFixed(2),
    b.toFixed(2),
    c.toFixed(2),
    `${(b / c).toFixed(2)}x`,
    `${(a / c).toFixed(2)}x`,
  ]);
}

function fmt(n: number) {
  return Math.round(n).toLocaleString('en-US');
}
const header = [
  'scenario (ops/s, higher is better)',
  'baseline',
  'staticBoost',
  'paramBoost',
  'vs staticBoost',
  'vs baseline',
];
const all = [header, ...rows];
const widths = header.map((_, i) => Math.max(...all.map((r) => r[i].length)));
for (const [i, r] of all.entries()) {
  console.log(
    r
      .map((c, j) => (j === 0 ? c.padEnd(widths[j]) : c.padStart(widths[j])))
      .join('  ')
  );
  if (i === 0) console.log(widths.map((w) => '-'.repeat(w)).join('  '));
}
if (sink.v === 42) console.log(sink.v);
