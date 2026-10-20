import { Router, encodeRouteSegment, type Params } from './index.js';
import { parseUrl } from './parseUrl.js';
import { parseRoute } from './parseRoute.js';
import { RouteSyntaxError } from './routeSyntaxError.js';
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

const syntaxErrors = [
  '/[a][b]', // params must be separated
  '/[[a]]/b', // optional must be last
  '/[...a]/b', // wildcard must be last
  '/[[...a]]/b', // optional wildcard must be last
  '/[a]/[a]', // duplicate names
  '/x-[...a]', // wildcard must fill the segment
  '/x-[[a]]', // optional must fill the segment
  '/[a',
  '/[]',
  '/[1a]',
];
for (const pattern of syntaxErrors) {
  test(`syntax error > '${pattern}'`, () => {
    expect(() => parseRoute(pattern)).toThrow(RouteSyntaxError);
  });
}

// [url, pathname, search, hash]
const parseUrlTests: [string, string, string, string][] = [
  ['/a', '/a', '', ''],
  ['/a?x=1', '/a', '?x=1', ''],
  ['/a#top', '/a', '', '#top'],
  ['/a?x=1#top', '/a', '?x=1', '#top'],
  ['/a#top?x=1', '/a', '', '#top?x=1'], // '?' after '#' belongs to the hash
  ['/a?x=1?y=2', '/a', '?x=1?y=2', ''], // only the first '?' starts the query
  ['/a#one#two', '/a', '', '#one#two'],
  ['/a?', '/a', '', ''], // bare '?' / '#' are empty, like URL
  ['/a#', '/a', '', ''],
  ['/a?#', '/a', '', ''],
  ['/a/?x=1', '/a/', '?x=1', ''],
  ['?x=1', '', '?x=1', ''],
  ['', '', '', ''],
];
for (const [url, pathname, search, hash] of parseUrlTests) {
  test(`parseUrl > '${url}'`, () => {
    expect(parseUrl(url)).toEqual({ pathname, search, hash });
  });
}

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

// Static text in a pattern is decoded, like the URL segments it is compared with,
// so `/hello%20world`, `/hello world` and the URL a browser sends all mean the same thing.
const encodedPatternTests: [string, string, Params | null][] = [
  ['/hello%20world', '/hello%20world', {}],
  ['/hello%20world', '/hello world', {}],
  ['/hello world', '/hello%20world', {}],
  ['/hello%20world', '/hello%2520world', null], // that URL is the text 'hello%20world'

  ['/caf%C3%A9', '/caf%C3%A9', {}],
  ['/caf%C3%A9', '/café', {}],
  ['/café', '/caf%C3%A9', {}],
  ['/caf%c3%a9', '/caf%C3%A9', {}], // hex case does not matter

  ['/100%25', '/100%25', {}],
  ['/100%25', '/100%', {}], // a malformed escape in the URL stays as text
  ['/100%', '/100%25', {}], // and so does one in the pattern
  ['/%2540', '/%2540', {}], // '%40' as text, encoded twice

  // an encoded '/' is one segment, never two
  ['/a%2Fb', '/a%2Fb', {}],
  ['/a%2Fb', '/a/b', null],
  ['/a/b', '/a%2Fb', null],

  // an encoded bracket is a literal bracket, not router syntax
  ['/a%5Bb%5D', '/a[b]', {}],
  ['/a%5Bb%5D', '/a%5Bb%5D', {}],
  ['/%5Bslug%5D', '/[slug]', {}],
  ['/%5Bslug%5D', '/hello', null],

  // mixed segments: text is decoded, params capture decoded values
  ['/my%20file-[id]', '/my%20file-7', { id: '7' }],
  ['/my%20file-[id]', '/my file-7', { id: '7' }],
  ['/caf%C3%A9.[ext]', '/café.pdf', { ext: 'pdf' }],
  ['/caf%C3%A9.[ext]', '/caf%C3%A9.pdf', { ext: 'pdf' }],
  ['/[a]-%5Bb%5D', '/1-[b]', { a: '1' }],

  // encoded folders around params
  ['/mes%20photos/[id]', '/mes%20photos/caf%C3%A9', { id: 'café' }],
  ['/docs%20v2/[...path]', '/docs%20v2/a%20b/c', { path: ['a b', 'c'] }],
];
for (const [pattern, url, expected] of encodedPatternTests) {
  test(`encoded pattern > '${pattern}' ~ '${url}'`, () => {
    expect(
      new Router<string>().add(pattern, pattern).match(url)?.params ?? null
    ).toEqual(expected);
  });
}

test('encoded pattern > an encoded static route beats a param', () => {
  for (const order of [
    ['/[a]', '/caf%C3%A9'],
    ['/caf%C3%A9', '/[a]'],
  ]) {
    const router = new Router<string>();
    for (const p of order) router.add(p, p);
    expect(router.match('/café')?.value).toEqual('/caf%C3%A9');
    expect(router.match('/caf%C3%A9')?.value).toEqual('/caf%C3%A9');
    expect(router.match('/cafe')?.value).toEqual('/[a]');
  }
});

// [file or folder name, encoded segment]
const encodeRouteSegmentTests: [string, string][] = [
  ['', ''],

  // text is encoded
  ['hello world', 'hello%20world'],
  ['café', 'caf%C3%A9'],
  ['100%', '100%25'],
  ['what?', 'what%3F'],
  ['a#b', 'a%23b'],
  ['a&b=c', 'a%26b%3Dc'],
  ['你好', '%E4%BD%A0%E5%A5%BD'],
  ['😀', '%F0%9F%98%80'],
  ['a%20b', 'a%2520b'],
  ['tab\there', 'tab%09here'],

  // unreserved characters are kept
  ['abc-DEF_123.~', 'abc-DEF_123.~'],
  ["!*'()", "!*'()"],

  // router syntax is kept as is
  ['[slug]', '[slug]'],
  ['[$id]', '[$id]'],
  ['[_a1]', '[_a1]'],
  ['[...path]', '[...path]'],
  ['[[lang]]', '[[lang]]'],
  ['[[...all]]', '[[...all]]'],
  ['[a]-[b]', '[a]-[b]'],

  // text around params is encoded, the params are not
  ['my file-[id]', 'my%20file-[id]'],
  ['café.[ext]', 'caf%C3%A9.[ext]'],
  ['[name] (copy).[ext]', '[name]%20(copy).[ext]'],

  // malformed brackets are not touched
  ['[1a]', '[1a]'],
  ['a[b', 'a[b'],
  ['[a', '[a'],
];
for (const [input, expected] of encodeRouteSegmentTests) {
  test(`encodeRouteSegment > '${input}' -> '${expected}'`, () => {
    expect(encodeRouteSegment(input)).toEqual(expected);
  });
}

for (const input of ['[1a]', 'a[b', '[a', 'x]', '[a]]', '[[a]]x']) {
  test(`encodeRouteSegment > '${input}' is still reported by parseRoute`, () => {
    expect(() => parseRoute(encodeRouteSegment(input))).toThrow(
      RouteSyntaxError
    );
  });
}

// whatever a name contains, its encoded pattern matches the URL made with encodeURIComponent
const trickyNames = [
  'hello world',
  'café',
  '100%',
  '%',
  '%%',
  '%zz',
  '%E0%A4%A',
  'a%2Fb',
  'a%20b',
  'what?',
  'a#b',
  'a&b=c',
  'a+b',
  'a,b;c',
  'a:b@c',
  'a\\b',
  "it's",
  '"quoted"',
  '<tag>',
  'tab\there',
  'new\nline',
  '你好',
  '😀',
  'ñ',
  ' ',
  '.',
  '..',
  '~',
  '-',
];
for (const name of trickyNames) {
  test(`encodeRouteSegment > round trip > ${JSON.stringify(name)}`, () => {
    const router = new Router<string>().add(encodeRouteSegment(name), 'hit');
    expect(router.match(`/${encodeURIComponent(name)}`)?.value).toEqual('hit');
  });
}
