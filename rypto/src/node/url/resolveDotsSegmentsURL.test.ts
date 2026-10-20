import { expect, test } from 'vitest';
import { resolveDotsSegmentsURL } from './resolveDotsSegmentsURL.js';

const allTests = [
  ['a simple path', 'images/logo.png', '/images/logo.png'],
  ['a leading slash', '/images/logo.png', '/images/logo.png'],
  ['multiple leading slashes', '///images/logo.png', '/images/logo.png'],
  ['repeated separators', 'images///logo.png', '/images/logo.png'],
  ['an empty path', '', '/'],
  ['only separators', '///', '/'],
  ['the current directory', '.', '/'],
  ['the parent directory at root', '..', '/'],
  [
    'nested current-directory segments',
    './images/./logo.png',
    '/images/logo.png',
  ],
  ['a parent segment in the middle', 'images/../logo.png', '/logo.png'],
  ['multiple parent segments', 'a/b/../../logo.png', '/logo.png'],
  ['parent traversal clamped at root', '../../../logo.png', '/logo.png'],
  ['traversal above root after nesting', 'a/../../../../logo.png', '/logo.png'],
  ['a filename containing dots', '.../file.txt', '/.../file.txt'],
  ['a filename containing two dots', '..hidden/file.txt', '/..hidden/file.txt'],
  ['a filename with an extension', 'file..txt', '/file..txt'],
  [
    'does not remove a parent-like name',
    'images/..hidden/logo.png',
    '/images/..hidden/logo.png',
  ],
  [
    'does not treat three dots as a parent segment',
    'images/.../logo.png',
    '/images/.../logo.png',
  ],
  [
    'does not let an empty segment interfere with parent resolution',
    'images//../logo.png',
    '/logo.png',
  ],
  ['does not preserve a trailing slash', 'images/', '/images'],
];
for (const [_label, before, after] of allTests) {
  test(`resolveDotsSegmentsURL > '${before}'`, () => {
    expect(resolveDotsSegmentsURL(before)).toEqual(after);
  });
}
