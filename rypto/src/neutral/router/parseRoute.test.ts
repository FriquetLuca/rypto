import { RouteSyntaxError } from './routeSyntaxError.js';
import { parseRoute } from './parseRoute.js';
import { expect, test } from 'vitest';

const syntaxErrors = [
  '/[a][b]', // params must be separated
  '/[[a]]/b', // optional must be last
  '/[...a]/b', // wildcard must be last
  '/[[...a]]/b', // optional wildcard must be last
  '/[a]/[a]', // duplicate names
  '/x-[...a]', // wildcard must fill the segment
  '/x-[[a]]', // optional must fill the segment
  '/[a',
  '/[]',
  '/[1a]',
];
for (const pattern of syntaxErrors) {
  test(`syntax error > '${pattern}'`, () => {
    expect(() => parseRoute(pattern)).toThrow(RouteSyntaxError);
  });
}
