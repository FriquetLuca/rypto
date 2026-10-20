import path from 'node:path';
import { expect, test } from 'vitest';
import { resolveRelativeURL } from './resolveRelativeURL.js';

const root = path.resolve('fixtures/public');

const allBaseTests = [
  ['simple filename', 'index.html', 'index.html'],
  ['nested path', 'images/logo.png', path.join('images', 'logo.png')],
  ['leading slash', '/images/logo.png', path.join('images', 'logo.png')],
  [
    'multiple leading slashes',
    '///images/logo.png',
    path.join('images', 'logo.png'),
  ],
  ['current directory segment', './index.html', 'index.html'],
  ['redundant separators', 'images//logo.png', path.join('images', 'logo.png')],
  ['dot segment within root', 'images/../index.html', 'index.html'],
  [
    'filename containing two dots',
    '.../file.txt',
    path.join('...', 'file.txt'),
  ],
  [
    'filename beginning with two dots',
    '..hidden/file.txt',
    path.join('..hidden', 'file.txt'),
  ],
  [
    'allows traversal syntax that normalizes to a path inside root',
    'images/../logo.png',
    'logo.png',
  ],
];
for (const [_label, before, after] of allBaseTests) {
  test(`resolveRelativeURL > '${before}'`, () => {
    expect(resolveRelativeURL(root, before)).toEqual(after);
  });
}

const allRejectedTests = [
  ['rejects traversal inputs that escape the root', 'images/../../secret.txt'],
  ['rejects traversal inputs that escape the root', '../secret.txt'],
  ['rejects traversal inputs that escape the root', '../../secret.txt'],
  ['rejects traversal inputs that escape the root', '/../../secret.txt'],
  [
    'rejects traversal inputs that escape the root',
    'images/../../../secret.txt',
  ],
  ['rejects traversal inputs that escape the root', './../../../secret.txt'],
];
for (const [_label, url] of allRejectedTests) {
  test(`resolveRelativeURL > '${url}'`, () => {
    expect(resolveRelativeURL(root, url)).toBeUndefined();
  });
}

const allResolvingRootTests = ['', '/', '///', '.'];
for (const rejectedValue of allResolvingRootTests) {
  test(`resolveRelativeURL > rejects a path resolving to the root: '${rejectedValue}'`, () => {
    expect(resolveRelativeURL(root, rejectedValue)).toBeUndefined();
  });
}

const allCustomRootTests = [
  [
    'accepts a root with a trailing separator',
    `${root}${path.sep}`,
    'index.html',
    'index.html',
  ],
  [
    'works with a relative root',
    'public',
    'images/logo.png',
    path.join('images', 'logo.png'),
  ],
];
for (const [_label, root, before, after] of allCustomRootTests) {
  test(`resolveRelativeURL > '${before}'`, () => {
    expect(resolveRelativeURL(root, before)).toEqual(after);
  });
}
