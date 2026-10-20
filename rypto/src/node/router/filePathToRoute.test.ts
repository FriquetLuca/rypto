import path from 'node:path';
import { expect, test } from 'vitest';
import { Router, type Params } from '../../neutral/router/index.js';
import { filePathToRoute } from './filePathToRoute.js';

const root = path.resolve('/app/pages');
const file = (...segments: string[]) => path.join(root, ...segments);

const filePathToRouteTests: [string[], string][] = [
  [['index'], '/'],
  [['about'], '/about'],
  [['blog', 'index'], '/blog'],
  [['blog', 'hello'], '/blog/hello'],
  [['a', 'b', 'c'], '/a/b/c'],
  [['a', 'b', 'c', 'index'], '/a/b/c'],
  [['blog', 'index', 'hello'], '/blog/index/hello'],
  [['index', 'hello'], '/index/hello'],
  [['index', 'index'], '/index'],
  [['blog', '[slug]'], '/blog/[slug]'],
  [['blog', '[slug]', 'index'], '/blog/[slug]'],
  [['[[lang]]', 'index'], '/[[lang]]'],
  [['docs', '[...path]'], '/docs/[...path]'],
  [['[[...all]]'], '/[[...all]]'],
  [['files', '[name].[ext]'], '/files/[name].[ext]'],
  [['[lang]', 'blog', '[slug]', 'index'], '/[lang]/blog/[slug]'],
  [['v1.2', 'index'], '/v1.2'],
];
for (const [segments, route] of filePathToRouteTests) {
  test(`filePathToRoute > ${segments.join(' / ')} -> '${route}'`, () => {
    expect(filePathToRoute(root, file(...segments))).toEqual(route);
  });
}
const encodingTests: [string[], string][] = [
  [['hello world'], '/hello%20world'],
  [['café', 'index'], '/caf%C3%A9'],
  [['100%'], '/100%25'],
  [['what?'], '/what%3F'],
  [['a#b'], '/a%23b'],
  [['a&b=c'], '/a%26b%3Dc'],
  [['你好', 'world'], '/%E4%BD%A0%E5%A5%BD/world'],
  [['emoji-😀'], '/emoji-%F0%9F%98%80'],
  [['a%20b'], '/a%2520b'],
  [["a-b_c.d~e!f*g(h)'i"], "/a-b_c.d~e!f*g(h)'i"],
  [['blog', '[slug]'], '/blog/[slug]'],
  [['[$id]'], '/[$id]'],
  [['docs', '[...path]'], '/docs/[...path]'],
  [['[[lang]]', 'index'], '/[[lang]]'],
  [['[[...all]]'], '/[[...all]]'],
  [['my file-[id]'], '/my%20file-[id]'],
  [['café.[ext]'], '/caf%C3%A9.[ext]'],
  [['[name] (copy).[ext]'], '/[name]%20(copy).[ext]'],
  [['mes photos', 'été', '[id]', 'index'], '/mes%20photos/%C3%A9t%C3%A9/[id]'],
  [['[1a]'], '/[1a]'],
  [['a[b'], '/a[b'],
];
for (const [segments, route] of encodingTests) {
  test(`filePathToRoute > encoding > ${segments.join(' / ')} -> '${route}'`, () => {
    expect(filePathToRoute(root, file(...segments))).toEqual(route);
  });
}

const endToEndTests: [string[], string, Params | null][] = [
  [['hello world'], '/hello%20world', {}],
  [['hello world'], '/hello world', {}],
  [['hello world'], '/hello%2520world', null],
  [['café'], '/caf%C3%A9', {}],
  [['café'], '/café', {}],
  [['café'], '/caf%c3%a9', {}],
  [['100%'], '/100%25', {}],
  [['what?'], '/what%3F', {}],
  [['what?'], '/what?x=1', null],
  [['a#b'], '/a%23b', {}],
  [['a#b'], '/a#b', null],
  [['a%20b'], '/a%2520b', {}],
  [['a%20b'], '/a%20b', null],
  [['blog', '[slug]'], '/blog/caf%C3%A9', { slug: 'café' }],
  [
    ['files', '[name].[ext]'],
    '/files/r%C3%A9sum%C3%A9.pdf',
    { name: 'résumé', ext: 'pdf' },
  ],
  [['my file-[id]'], '/my%20file-7', { id: '7' }],
  [['docs', '[...path]'], '/docs/a%20b/c', { path: ['a b', 'c'] }],
];
for (const [segments, url, expected] of endToEndTests) {
  test(`filePathToRoute > end to end > ${segments.join(' / ')} ~ '${url}'`, () => {
    const route = filePathToRoute(root, file(...segments));
    expect(
      new Router<string>().add(route, route).match(url)?.params ?? null
    ).toEqual(expected);
  });
}

test('filePathToRoute > the root directory itself is the home route', () => {
  expect(filePathToRoute(root, root)).toEqual('/');
});
test('filePathToRoute > a trailing separator on the root makes no difference', () => {
  expect(filePathToRoute(root + path.sep, file('blog', 'index'))).toEqual(
    '/blog'
  );
});
test('filePathToRoute > relative root and file paths', () => {
  const rel = (...segments: string[]) => path.join('app', 'pages', ...segments);
  expect(filePathToRoute(rel(), rel('blog', 'index'))).toEqual('/blog');
});
