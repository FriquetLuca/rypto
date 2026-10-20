import { expect, test } from 'vitest';
import { discardDotsSegmentsURL } from './discardDotsSegmentsURL.js';

const allTests = [
  ['a simple path', 'images/logo.png', '/images/logo.png'],
  ['a leading slash', '/images/logo.png', '/images/logo.png'],
  ['multiple leading slashes', '///images/logo.png', '/images/logo.png'],
  ['repeated separators', 'images///logo.png', '/images/logo.png'],
  ['an empty path', '', '/'],
  ['only separators', '///', '/'],
  ['the current directory', '.', '/'],
  ['the parent directory', '..', '/'],
  ['a current-directory segment', './images/logo.png', '/images/logo.png'],
  ['a parent segment in the middle', 'images/../logo.png', '/images/logo.png'],
  ['multiple parent segments', 'a/b/../../logo.png', '/a/b/logo.png'],
  ['parent segments at the beginning', '../../secret.txt', '/secret.txt'],
  ['parent segments at the end', 'images/..', '/images'],
  ['a filename containing dots', '.../file.txt', '/.../file.txt'],
  [
    'a filename beginning with two dots',
    '..hidden/file.txt',
    '/..hidden/file.txt',
  ],
  ['a filename with an extension', 'file..txt', '/file..txt'],
];
for (const [_label, before, after] of allTests) {
  test(`discardDotsSegmentsURL > '${before}'`, () => {
    expect(discardDotsSegmentsURL(before)).toEqual(after);
  });
}
