import { expect, test, vi } from 'vitest';

// `filePathToRoute` uses `path.sep` and `path.relative`, which depend on the OS running the tests.
// `path.win32` is a pure implementation, so swapping it in tests Windows behaviour on any machine.
vi.mock('node:path', async () => {
  const actual = await vi.importActual<typeof import('node:path')>('node:path');
  return { ...actual, default: actual.win32 };
});

const { filePathToRoute, removeFilePathExt } = await import('./index.js');

const win32Tests: [string, string, string][] = [
  ['C:\\app\\pages', 'C:\\app\\pages\\index', '/'],
  ['C:\\app\\pages', 'C:\\app\\pages\\about', '/about'],
  ['C:\\app\\pages', 'C:\\app\\pages\\blog\\index', '/blog'],
  ['C:\\app\\pages', 'C:\\app\\pages\\blog\\[slug]', '/blog/[slug]'],
  ['C:\\app\\pages', 'C:\\app\\pages\\blog\\[slug]\\index', '/blog/[slug]'],
  ['C:\\app\\pages', 'C:\\app\\pages\\docs\\[...path]', '/docs/[...path]'],
  ['C:\\app\\pages', 'C:\\app\\pages\\blog\\index\\hello', '/blog/index/hello'],
  ['C:\\app\\pages\\', 'C:\\app\\pages\\blog\\index', '/blog'],
  ['C:\\app\\pages', 'C:\\app\\pages', '/'],
  ['C:/app/pages', 'C:/app/pages/blog/[slug]', '/blog/[slug]'],
  ['C:\\app\\pages', 'C:/app/pages/blog/index', '/blog'],
  ['C:\\app/pages', 'C:/app\\pages\\index', '/'],
  ['C:\\App\\Pages', 'c:\\app\\pages\\blog\\index', '/blog'],
];
for (const [root, filePath, route] of win32Tests) {
  test(`win32 > filePathToRoute('${root}', '${filePath}') -> '${route}'`, () => {
    expect(filePathToRoute(root, filePath)).toEqual(route);
  });
}

test('win32 > the full pipeline with a render-mode suffix', () => {
  const filePath = 'C:\\app\\pages\\blog\\[slug]\\index.ssg.tsx';
  expect(
    filePathToRoute('C:\\app\\pages', removeFilePathExt(filePath))
  ).toEqual('/blog/[slug]');
});
