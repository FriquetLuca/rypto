import { expect, test } from 'vitest';
import { fileRenderMode, type RenderMode } from './fileRenderMode.js';

const renderModeTests: [string, RenderMode][] = [
  ['a.ssr.tsx', 'ssr'],
  ['a.ssr.ts', 'ssr'],
  ['a.ssr.jsx', 'ssr'],
  ['a.ssr.js', 'ssr'],
  ['a.ssg.tsx', 'ssg'],
  ['a.ssg.ts', 'ssg'],
  ['a.csr.tsx', 'csr'],
  ['a.csr.js', 'csr'],
  ['/app/pages/blog/[slug].ssg.tsx', 'ssg'],
  ['C:\\app\\pages\\a.csr.tsx', 'csr'],
  ['a.b.csr.tsx', 'csr'],
  ['a.ssr.ssg.tsx', 'ssg'],
  ['a.ssg.ssr.tsx', 'ssr'],
  ['a', 'ssr'],
  ['a.tsx', 'ssr'],
  ['a.ts', 'ssr'],
  ['a.js', 'ssr'],
  ['index.tsx', 'ssr'],
  ['a.server.ts', 'ssr'],
  ['a.ssg.server.tsx', 'ssr'],
  ['a.csr.server.ts', 'ssr'],
  ['a.ssr.server.js', 'ssr'],
  ['a.SSG.tsx', 'ssr'],
  ['a.ssg', 'ssr'],
  ['a.ssg.css', 'ssr'],
  ['a.ssg.mdx', 'ssr'],
  ['a.ssg.tsx.map', 'ssr'],
  ['a.ssgx.tsx', 'ssr'],
  ['blog.ssg.tsx/index.tsx', 'ssr'],
];
for (const [filePath, mode] of renderModeTests) {
  test(`fileRenderMode > '${filePath}' -> '${mode}'`, () => {
    expect(fileRenderMode(filePath)).toEqual(mode);
  });
}
