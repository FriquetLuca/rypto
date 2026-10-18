import { hello } from './index.js';
import { expect, test } from 'vitest';

test('test is working', () => {
  expect(hello()).toEqual('hello world');
});
