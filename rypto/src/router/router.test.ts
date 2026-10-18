import { Router, type Params } from './router.js';
import { expect, test } from 'vitest';

// [pattern, url, expected params (null = no match)]
const matchTests: [string, string, Params | null][] = [
  // static
  ['/', '/', {}],
  ['', '/', {}],
  ['/about', '/about', {}],
  ['/about', '/about/', {}],
  ['/about', '/other', null],
  ['/about', '/about?x=1#top', {}],

  // index handling on the pattern (file based routing)
  ['/index', '/', {}],
  ['/blog/index', '/blog', {}],
  ['blog/[slug]/index', '/blog/hello', { slug: 'hello' }],

  // [param]
  ['/blog/[slug]', '/blog/hello', { slug: 'hello' }],
  ['/blog/[slug]', '/blog', null],
  ['/blog/[slug]', '/blog/a/b', null],
  ['/blog/[slug]', '/blog/hello%20world', { slug: 'hello world' }],

  // [[optional]]
  ['/blog/[[page]]', '/blog', {}],
  ['/blog/[[page]]', '/blog/2', { page: '2' }],
  ['/blog/[[page]]', '/blog/2/3', null],

  // [...wildcard]
  ['/docs/[...path]', '/docs', null],
  ['/docs/[...path]', '/docs/a', { path: ['a'] }],
  ['/docs/[...path]', '/docs/a/b/c', { path: ['a', 'b', 'c'] }],

  // [[...optionalWildcard]]
  ['/docs/[[...path]]', '/docs', { path: [] }],
  ['/docs/[[...path]]', '/docs/a/b', { path: ['a', 'b'] }],

  // several params, separated by static text or by slashes
  ['/[lang]/blog/[slug]', '/fr/blog/salut', { lang: 'fr', slug: 'salut' }],
  [
    '/archive/[year]-[month]',
    '/archive/2024-05',
    { year: '2024', month: '05' },
  ],
  ['/files/[name].[ext]', '/files/report.pdf', { name: 'report', ext: 'pdf' }],
  ['/files/[name].[ext]', '/files/report', null],
  ['/[lang]/[[...rest]]', '/en', { lang: 'en', rest: [] }],
  ['/[lang]/[[...rest]]', '/en/a/b', { lang: 'en', rest: ['a', 'b'] }],
];
for (const [pattern, url, expected] of matchTests) {
  test(`match > '${pattern}' ~ '${url}'`, () => {
    const result = new Router<string>().add(pattern, pattern).match(url);
    expect(result?.params ?? null).toEqual(expected);
  });
}

const permutations = <T>(items: T[]): T[][] =>
  items.length <= 1
    ? [items]
    : items.flatMap((item, i) =>
        permutations([...items.slice(0, i), ...items.slice(i + 1)]).map(
          (rest) => [item, ...rest]
        )
      );

// [patterns, url, expected winning pattern (null = no match)]
// No case here is a tie, so the winner must not depend on registration order:
// every case is run against every permutation of its patterns.
const priorityTests: [string[], string, string | null][] = [
  // static > dynamic
  [['/[a]', '/about'], '/about', '/about'],
  [['/[a]', '/about'], '/other', '/[a]'],
  [['/About', '/[a]'], '/about', '/[a]'], // case sensitive
  [['/[a]', '/about'], '/%61bout', '/about'], // decoded before matching
  [['/[a]', '/about'], '/about?x=1#top', '/about'], // query and hash ignored

  // mixed segments (static text + params)
  [['/[a]-[b]', '/[a]'], '/1-2', '/[a]-[b]'],
  [['/[a]-[b]', '/[a]'], '/12', '/[a]'],
  [['/file.[ext]', '/file.txt'], '/file.txt', '/file.txt'],
  [['/file.[ext]', '/[name]'], '/file.txt', '/file.[ext]'],
  [['/x-[b]', '/[a]-[b]'], '/x-2', '/x-[b]'], // more static text = more specific
  [['/x-[b]', '/[a]-[b]'], '/y-2', '/[a]-[b]'],
  [['/pre-[a]', '/pre-[a]-post'], '/pre-1-post', '/pre-[a]-post'],

  // earlier segments dominate later ones
  [['/a/[x]', '/[y]/b'], '/a/b', '/a/[x]'],
  [['/a/b/c', '/a/[...rest]'], '/a/b/c', '/a/b/c'],
  [['/a/[...rest]', '/[a]/[b]/[c]'], '/a/b/c', '/a/[...rest]'],
  [['/[a]/[b]', '/[...rest]'], '/1/2', '/[a]/[b]'],
  [['/[a]/x', '/[a]/[b]'], '/1/x', '/[a]/x'],
  [['/[a]/b/[...rest]', '/[a]/[b]/c'], '/1/b/c', '/[a]/b/[...rest]'],

  // falls through to the next route when the best-ranked one does not match
  [['/a/b', '/[x]/c'], '/a/c', '/[x]/c'],
  [['/a/b', '/[x]/c', '/[...rest]'], '/z/z', '/[...rest]'],
  [['/a/[x]', '/[...rest]'], '/a', '/[...rest]'],

  // [[optional]]
  [['/blog/[[page]]', '/blog'], '/blog', '/blog'],
  [['/blog/[[page]]', '/blog'], '/blog/2', '/blog/[[page]]'],
  [['/[[page]]', '/'], '/', '/'],
  [['/[a]/[[b]]', '/[a]'], '/1', '/[a]'],
  [['/[a]/[[b]]', '/[a]/[...b]'], '/1/2', '/[a]/[[b]]'],

  // [...wildcard] and [[...optionalWildcard]]
  [['/[[...all]]', '/'], '/', '/'],
  [['/[[...all]]', '/[[page]]'], '/', '/[[page]]'],
  [['/[[...all]]', '/[...all]'], '/a', '/[...all]'],
  [['/[[...all]]', '/[...all]'], '/', '/[[...all]]'],
  [['/docs/[[...path]]', '/docs'], '/docs', '/docs'],
  [['/docs/[...path]', '/docs/[[...path]]'], '/docs/a/b', '/docs/[...path]'],
  [['/docs/[[page]]', '/docs/[[...path]]'], '/docs/a/b', '/docs/[[...path]]'],

  // index files are normalized on the pattern side only
  [['/blog/index', '/blog/[slug]'], '/blog', '/blog/index'],
  [['/blog/index', '/blog/[slug]'], '/blog/hello', '/blog/[slug]'],
  [['/blog/index', '/blog/[slug]'], '/blog/index', '/blog/[slug]'],

  // realistic locale-prefixed site
  [
    ['/[lang]', '/[lang]/blog', '/[lang]/blog/[slug]', '/[lang]/[...rest]'],
    '/en',
    '/[lang]',
  ],
  [
    ['/[lang]', '/[lang]/blog', '/[lang]/blog/[slug]', '/[lang]/[...rest]'],
    '/en/blog',
    '/[lang]/blog',
  ],
  [
    ['/[lang]', '/[lang]/blog', '/[lang]/blog/[slug]', '/[lang]/[...rest]'],
    '/en/blog/x',
    '/[lang]/blog/[slug]',
  ],
  [
    ['/[lang]', '/[lang]/blog', '/[lang]/blog/[slug]', '/[lang]/[...rest]'],
    '/en/about/team',
    '/[lang]/[...rest]',
  ],
  [
    ['/[lang]', '/[lang]/blog', '/[lang]/blog/[slug]', '/[lang]/[...rest]'],
    '/',
    null,
  ],

  // no match
  [['/a', '/[x]/b'], '/a/c', null],
  [['/[a]'], '/', null],
  [['/[...rest]'], '/', null],
  [[], '/', null],
];
for (const [patterns, url, expected] of priorityTests) {
  test(`priority > [${patterns.join(', ')}] ~ '${url}'`, () => {
    for (const order of permutations(patterns)) {
      const router = new Router<string>();
      for (const p of order) router.add(p, p);
      expect(
        router.match(url)?.value ?? null,
        `registered as [${order.join(', ')}]`
      ).toEqual(expected);
    }
  });
}

// Real ties: same specificity, so the first registered route wins.
const tieTests: [string[], string][] = [
  [['/[a]', '/[b]'], '/x'],
  [['/[a]-[b]', '/[c]-[d]'], '/1-2'],
  [['/x-[a]', '/[b]-y'], '/x-y'],
  [['/[...a]', '/[...b]'], '/x/y'],
  [['/[[a]]', '/[[b]]'], '/x'],
];
for (const [patterns, url] of tieTests) {
  test(`tie > [${patterns.join(', ')}] ~ '${url}' -> first registered`, () => {
    for (const order of [patterns, [...patterns].reverse()]) {
      const router = new Router<string>();
      for (const p of order) router.add(p, p);
      expect(
        router.match(url)?.value,
        `registered as [${order.join(', ')}]`
      ).toEqual(order[0]);
    }
  });
}

test('tie > same pattern registered twice -> first value wins', () => {
  const router = new Router<string>().add('/a', 'first').add('/a', 'second');
  expect(router.match('/a')?.value).toEqual('first');
});

test('priority > params come from the winning route only', () => {
  const router = new Router<string>()
    .add('/[a]/[b]', 'param')
    .add('/[a]/x', 'static');
  expect(router.match('/1/x')).toMatchObject({
    value: 'static',
    params: { a: '1' },
    pattern: '/[a]/x',
  });
  expect(router.match('/1/y')).toMatchObject({
    value: 'param',
    params: { a: '1', b: 'y' },
    pattern: '/[a]/[b]',
  });
});

test('match > exposes pathname, search, searchParams and hash', () => {
  const m = new Router<string>()
    .add('/blog/[slug]', 'post')
    .match('/blog/hello?x=1&x=2&y=%20z#top');
  expect(m?.pathname).toEqual('/blog/hello');
  expect(m?.search).toEqual('?x=1&x=2&y=%20z');
  expect(m?.hash).toEqual('#top');
  expect(m?.searchParams.getAll('x')).toEqual(['1', '2']);
  expect(m?.searchParams.get('y')).toEqual(' z');
  expect(m?.searchParams.get('missing')).toBeNull();
});

test('match > empty search and hash', () => {
  const m = new Router<string>().add('/', 'home').match('/');
  expect(m).toMatchObject({ pathname: '/', search: '', hash: '' });
  expect([...m!.searchParams]).toEqual([]);
});

test('match > route params and query params stay separate', () => {
  const m = new Router<string>()
    .add('/blog/[slug]', 'post')
    .match('/blog/hello?slug=other');
  expect(m?.params).toEqual({ slug: 'hello' });
  expect(m?.searchParams.get('slug')).toEqual('other');
});

test('match > query and hash never change which route wins', () => {
  const router = new Router<string>()
    .add('/[a]', 'param')
    .add('/about', 'static')
    .add('/[...rest]', 'rest');
  for (const suffix of ['', '?x=1', '#top', '?x=1#top', '?/about', '#/about']) {
    expect(router.match(`/about${suffix}`)?.value, suffix).toEqual('static');
    expect(router.match(`/other${suffix}`)?.value, suffix).toEqual('param');
    expect(router.match(`/x/y${suffix}`)?.value, suffix).toEqual('rest');
  }
});

test('match > no match returns null even with a query and hash', () => {
  expect(new Router<string>().add('/a', 'a').match('/b?x=1#top')).toBeNull();
});

// A decoded line terminator is a valid character inside a param value.
const lineTerminatorTests: [string, string, Params][] = [
  ['/[a]', '/a%0Ab', { a: 'a\nb' }],
  ['/[a]', '/a%0Db', { a: 'a\rb' }],
  ['/[a]', '/a%E2%80%A8b', { a: 'a\u2028b' }],
  ['/[a]', '/%0A', { a: '\n' }],
  ['/[a]', '/a%2Fb', { a: 'a/b' }], // an encoded slash stays inside one segment
  ['/x-[b]', '/x-1%0A2', { b: '1\n2' }],
  ['/[a]-[b]', '/1%0A-2%0A', { a: '1\n', b: '2\n' }],
  ['/[a]/[b]', '/a%0Ab/c%0Ad', { a: 'a\nb', b: 'c\nd' }],
];
for (const [pattern, url, expected] of lineTerminatorTests) {
  test(`match > '${pattern}' ~ '${url}'`, () => {
    expect(
      new Router<string>().add(pattern, pattern).match(url)?.params
    ).toEqual(expected);
  });
}
