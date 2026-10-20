import path from 'node:path';
import { expect, test } from 'vitest';
import { filePathToRoute } from './filePathToRoute.js';
import {
  fileRenderMode,
  isServerFile,
  removeFilePathExt,
} from '../router/index.js';

const root = path.resolve('/app/pages');
const file = (...segments: string[]) => path.join(root, ...segments);

const pipelineTests: [string, string][] = [
  ['index.ssr.tsx', '/'],
  ['index.ssg.tsx', '/'],
  ['index.csr.jsx', '/'],
  ['about.ssr.tsx', '/about'],
  ['blog/index.csr.tsx', '/blog'],
  ['blog/[slug].ssr.tsx', '/blog/[slug]'],
  ['blog/[slug]/index.ssg.ts', '/blog/[slug]'],
  ['docs/[...path].csr.js', '/docs/[...path]'],
  ['api/users.server.ts', '/api/users'],
  ['api/index.server.js', '/api'],
];
for (const [relative, route] of pipelineTests) {
  test(`pipeline > '${relative}' -> '${route}'`, () => {
    const filePath = file(...relative.split('/'));
    expect(filePathToRoute(root, removeFilePathExt(filePath))).toEqual(route);
  });
}

const suffixes = ['ssr', 'ssg', 'csr', 'server'] as const;
const extensions = ['ts', 'tsx', 'js', 'jsx'] as const;
for (const suffix of suffixes) {
  for (const ext of extensions) {
    test(`consistency > 'page.${suffix}.${ext}'`, () => {
      const filePath = `/app/pages/page.${suffix}.${ext}`;
      expect(removeFilePathExt(filePath)).toEqual('/app/pages/page');
      expect(isServerFile(filePath)).toEqual(suffix === 'server');
      expect(fileRenderMode(filePath)).toEqual(
        suffix === 'server' ? 'ssr' : suffix
      );
    });
  }
}
