import { test, expect } from 'vitest';
import { resolveProperty } from './resolveProperty';

test.each([
  [
    'resolves an exact literal key',
    { 'a.b.c.d': 'literal' },
    'a.b.c.d',
    'literal',
  ],
  ['resolves a simple root property', { a: 'value' }, 'a', 'value'],
  [
    'resolves nested properties',
    { a: { b: { c: { d: 'nested' } } } },
    'a.b.c.d',
    'nested',
  ],
  [
    'resolves a dotted literal prefix',
    { 'a.b': { c: { d: 'found' } } },
    'a.b.c.d',
    'found',
  ],
  [
    'backtracks when the longest prefix fails',
    { 'a.b.c': { x: 1 }, 'a.b': { 'c.d': 'found' } },
    'a.b.c.d',
    'found',
  ],
  [
    'uses the longest prefix that resolves successfully',
    { 'a.b.c': { d: 'longest' }, 'a.b': { c: { d: 'shorter' } } },
    'a.b.c.d',
    'longest',
  ],
  [
    'prefers an exact literal key over nested interpretations',
    { 'a.b.c.d': 'exact', 'a.b.c': { d: 'nested' } },
    'a.b.c.d',
    'exact',
  ],
  [
    'returns undefined when the property is missing',
    { a: { b: 1 } },
    'a.b.c',
    undefined,
  ],
  [
    'returns undefined when no root prefix exists',
    { x: { y: 1 } },
    'a.b.c',
    undefined,
  ],
  [
    'returns undefined when an intermediate value is null',
    { a: null },
    'a.b',
    undefined,
  ],
  [
    'returns undefined when an intermediate value is a primitive',
    { a: 42 },
    'a.b',
    undefined,
  ],
  ['resolves null values', { a: { b: null } }, 'a.b', null],
  ['resolves false values', { a: { b: false } }, 'a.b', false],
  ['resolves zero values', { a: { b: 0 } }, 'a.b', 0],
  ['resolves empty string values', { a: { b: '' } }, 'a.b', ''],
  [
    'does not resolve inherited properties',
    Object.assign(Object.create({ b: 'inherited' }), { a: {} }),
    'a.b',
    undefined,
  ],
  ['resolves array indices', { a: [{ b: 'found' }] }, 'a.0.b', 'found'],
])('%s', (_name, object, propertyName, expected) => {
  expect(resolveProperty(object, propertyName)).toEqual(expected);
});
