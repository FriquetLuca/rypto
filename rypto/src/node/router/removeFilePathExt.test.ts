import { expect, test } from 'vitest';
import { removeFilePathExt } from './removeFilePathExt.js';

const removeExtTests: [string, string][] = [
  ['a.ssr.tsx', 'a'],
  ['a.ssr.ts', 'a'],
  ['a.ssr.jsx', 'a'],
  ['a.ssr.js', 'a'],
  ['a.ssg.tsx', 'a'],
  ['a.csr.tsx', 'a'],
  ['a.server.ts', 'a'],
  ['a.server.tsx', 'a'],
  ['/app/pages/blog/[slug].ssr.tsx', '/app/pages/blog/[slug]'],
  ['C:\\app\\pages\\a.ssg.ts', 'C:\\app\\pages\\a'],
  ['a.b.ssr.tsx', 'a.b'],
  ['a.ssr.ssg.tsx', 'a.ssr'],
  ['a.ssr.tsx.ssr.tsx', 'a.ssr.tsx'],
];
for (const [left, right] of removeExtTests) {
  test(`removeFilePathExt > '${left}' -> '${right}'`, () => {
    expect(removeFilePathExt(left)).toEqual(right);
  });
}

const keepExtTests = [
  'a',
  'a.tsx',
  'a.ts',
  'a.jsx',
  'a.js',
  'a.ssr',
  'a.server',
  'a.ssr.css',
  'a.ssr.json',
  'a.ssr.mdx',
  'a.ssr.d.ts',
  'a.ssr.mjs',
  'a.ssr.cjs',
  'a.ssr.mts',
  'a.ssr.tsx.map',
  'a.ssr.tsx.bak',
  'a.SSR.tsx',
  'a.foo.tsx',
  'a.servers.ts',
  'assr.tsx',
  'ssr.tsx',
];
for (const input of keepExtTests) {
  test(`removeFilePathExt > '${input}' is unchanged`, () => {
    expect(removeFilePathExt(input)).toEqual(input);
  });
}
