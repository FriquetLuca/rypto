import { parseUrl } from './parseUrl.js';
import { expect, test } from 'vitest';

const parseUrlTests: [string, string, string, string][] = [
  ['/a', '/a', '', ''],
  ['/a?x=1', '/a', '?x=1', ''],
  ['/a#top', '/a', '', '#top'],
  ['/a?x=1#top', '/a', '?x=1', '#top'],
  ['/a#top?x=1', '/a', '', '#top?x=1'],
  ['/a?x=1?y=2', '/a', '?x=1?y=2', ''],
  ['/a#one#two', '/a', '', '#one#two'],
  ['/a?', '/a', '', ''],
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
