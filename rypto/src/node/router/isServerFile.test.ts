import { expect, test } from 'vitest';
import { isServerFile } from './isServerFile.js';

const serverFileTests: [string, boolean][] = [
  ['a.server.ts', true],
  ['a.server.tsx', true],
  ['a.server.js', true],
  ['a.server.jsx', true],
  ['a.b.server.ts', true],
  ['a.ssg.server.tsx', true],
  ['a.csr.server.ts', true],
  ['a.ssr.server.js', true],
  ['/app/pages/api/users.server.ts', true],
  ['C:\\app\\pages\\api\\users.server.ts', true],
  ['a', false],
  ['a.ts', false],
  ['a.tsx', false],
  ['a.ssr.tsx', false],
  ['a.ssg.tsx', false],
  ['a.csr.tsx', false],
  ['server.ts', false],
  ['server', false],
  ['a.server', false],
  ['a.server.css', false],
  ['a.server.json', false],
  ['a.server.d.ts', false],
  ['a.server.tsx.map', false],
  ['a.servers.ts', false],
  ['a.Server.ts', false],
];
for (const [filePath, expected] of serverFileTests) {
  test(`isServerFile > '${filePath}' -> ${expected}`, () => {
    expect(isServerFile(filePath)).toEqual(expected);
  });
}
