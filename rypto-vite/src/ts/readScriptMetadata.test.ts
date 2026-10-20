import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readScriptMetadata } from './readScriptMetadata.js';

let dir: string;
let counter = 0;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'script-metadata-'));
});

afterAll(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

/** Writes `code` to a temp file and extracts the allow-listed exports. */
function read(
  code: string,
  allow: string[],
  ext: 'ts' | 'tsx' | 'js' | 'jsx' = 'ts'
): Record<string, unknown> {
  const file = path.join(dir, `case-${counter++}.${ext}`);
  fs.writeFileSync(file, code);
  return readScriptMetadata(file, allow);
}

describe('literals (existing behavior)', () => {
  it('reads booleans', () => {
    expect(
      read('export const a = true; export const b = false;', ['a', 'b'])
    ).toEqual({
      a: true,
      b: false,
    });
  });

  it('reads null (not dropped)', () => {
    expect(read('export const x = null;', ['x'])).toEqual({ x: null });
  });

  it('reads strings and numbers', () => {
    expect(
      read('export const s = "hi"; export const n = 42;', ['s', 'n'])
    ).toEqual({
      s: 'hi',
      n: 42,
    });
  });

  it('reads signed numbers', () => {
    expect(
      read('export const a = -5; export const b = +5;', ['a', 'b'])
    ).toEqual({
      a: -5,
      b: 5,
    });
  });

  it('reads arrays and objects', () => {
    const code = `export const x = { a: 1, "b-c": [true, "z"], 3: null };`;
    expect(read(code, ['x'])).toEqual({
      x: { a: 1, 'b-c': [true, 'z'], '3': null },
    });
  });
});

describe('constant resolution', () => {
  it('concatenates strings from other consts', () => {
    const code = `
      const A = "Hello";
      const B = "World";
      export const AB = A + " " + B;
    `;
    expect(read(code, ['AB'])).toEqual({ AB: 'Hello World' });
  });

  it('resolves regardless of declaration order', () => {
    const code = `
      export const AB = A + B;
      const A = "a";
      const B = "b";
    `;
    expect(read(code, ['AB'])).toEqual({ AB: 'ab' });
  });

  it('resolves chains of consts', () => {
    const code = `
      const A = "x";
      const B = A;
      const C = B;
      export const D = C;
    `;
    expect(read(code, ['D'])).toEqual({ D: 'x' });
  });

  it('resolves references to other exported consts', () => {
    const code = `
      export const A = "x";
      export const B = A + "y";
    `;
    expect(read(code, ['A', 'B'])).toEqual({ A: 'x', B: 'xy' });
  });

  it('does not inline let or var', () => {
    const code = `
      let A = "a";
      var B = "b";
      export const X = A;
      export const Y = B;
    `;
    expect(read(code, ['X', 'Y'])).toEqual({});
  });

  it('ignores identifiers that are not declared in the file', () => {
    expect(read('export const X = somethingImported;', ['X'])).toEqual({});
  });

  it('does not hang on circular references', () => {
    const code = `
      const A = B;
      const B = A;
      export const X = A;
    `;
    expect(read(code, ['X'])).toEqual({});
  });

  it('does not hang on self references', () => {
    expect(read('const A = A; export const X = A;', ['X'])).toEqual({});
  });
});

describe('expressions', () => {
  it('supports template literals with substitutions', () => {
    const code =
      'const N = "World"; const V = 2; export const T = `Hello ${N} v${V}!`;';
    expect(read(code, ['T'])).toEqual({ T: 'Hello World v2!' });
  });

  it('supports template literals without substitutions', () => {
    expect(read('export const T = `plain`;', ['T'])).toEqual({ T: 'plain' });
  });

  it('drops template literals with unresolvable substitutions', () => {
    expect(read('export const T = `a ${foo()} b`;', ['T'])).toEqual({});
  });

  it('supports numeric arithmetic with correct precedence', () => {
    const code = `
      const A = 2;
      const B = 3;
      export const X = A * B + 1;
      export const Y = (A + B) * 2;
      export const Z = 2 ** 3;
      export const M = 7 % 4;
      export const D = 10 / 4;
      export const S = 5 - 8;
    `;
    expect(read(code, ['X', 'Y', 'Z', 'M', 'D', 'S'])).toEqual({
      X: 7,
      Y: 10,
      Z: 8,
      M: 3,
      D: 2.5,
      S: -3,
    });
  });

  it('coerces primitives when concatenating with a string', () => {
    const code = `
      export const A = "v" + 1;
      export const B = 1 + "v";
      export const C = "ok:" + true;
      export const D = "n:" + null;
    `;
    expect(read(code, ['A', 'B', 'C', 'D'])).toEqual({
      A: 'v1',
      B: '1v',
      C: 'ok:true',
      D: 'n:null',
    });
  });

  it('does not fold strings with objects or arrays', () => {
    const code = `
      export const A = "x" + {};
      export const B = "x" + [1];
    `;
    expect(read(code, ['A', 'B'])).toEqual({});
  });

  it('does not apply non-plus arithmetic to strings', () => {
    expect(read('export const X = "a" * 2;', ['X'])).toEqual({});
  });

  it('supports logical operators', () => {
    const code = `
      export const A = null ?? "fallback";
      export const B = "" || "fallback";
      export const C = true && "yes";
      export const D = !false;
    `;
    expect(read(code, ['A', 'B', 'C', 'D'])).toEqual({
      A: 'fallback',
      B: 'fallback',
      C: 'yes',
      D: true,
    });
  });

  it('drops anything involving function calls or property access', () => {
    const code = `
      const A = "abc";
      export const X = A.length;
      export const Y = A + foo();
      export const Z = Math.PI;
    `;
    expect(read(code, ['X', 'Y', 'Z'])).toEqual({});
  });
});

describe('TypeScript wrappers', () => {
  it('unwraps `as const`, `satisfies`, parentheses and non-null assertions', () => {
    const code = `
      const A = "a";
      export const X = A as const;
      export const Y = ("y") satisfies string;
      export const Z = (A + "z" as string)!;
      export const O = { k: A } as const;
    `;
    expect(read(code, ['X', 'Y', 'Z', 'O'])).toEqual({
      X: 'a',
      Y: 'y',
      Z: 'az',
      O: { k: 'a' },
    });
  });

  it('works with type annotations on declarations', () => {
    const code = `
      const A: string = "a";
      export const B: string = A + "b";
    `;
    expect(read(code, ['B'])).toEqual({ B: 'ab' });
  });
});

describe('objects and arrays with references', () => {
  it('resolves references inside objects and arrays', () => {
    const code = `
      const NAME = "svc";
      const PORT = 8080;
      export const config = {
        name: NAME,
        url: "http://" + NAME + ":" + PORT,
        ports: [PORT, PORT + 1],
      };
    `;
    expect(read(code, ['config'])).toEqual({
      config: {
        name: 'svc',
        url: 'http://svc:8080',
        ports: [8080, 8081],
      },
    });
  });

  it('supports shorthand properties', () => {
    const code = `
      const A = 1;
      export const x = { A };
    `;
    expect(read(code, ['x'])).toEqual({ x: { A: 1 } });
  });

  it('omits unresolvable object properties but keeps the rest', () => {
    const code = `
      export const x = { ok: 1, bad: foo(), alsoOk: "y", ...spread };
    `;
    expect(read(code, ['x'])).toEqual({ x: { ok: 1, alsoOk: 'y' } });
  });

  // Documents current behavior: unresolvable array elements become `undefined`
  // (JSON-serializing this would turn them into `null`).
  it('keeps array length when an element is unresolvable', () => {
    const result = read('export const x = [1, foo(), 3];', ['x']);
    expect(result).toEqual({ x: [1, undefined, 3] });
  });
});

describe('filtering', () => {
  it('only returns allow-listed properties', () => {
    const code = `
      export const a = 1;
      export const b = 2;
    `;
    expect(read(code, ['a'])).toEqual({ a: 1 });
  });

  it('ignores non-exported declarations, even if allow-listed', () => {
    const code = `
      const a = 1;
      export const b = 2;
    `;
    expect(read(code, ['a', 'b'])).toEqual({ b: 2 });
  });

  it('returns an empty object when nothing matches', () => {
    expect(read('export const a = 1;', [])).toEqual({});
  });

  it('handles multiple declarators in one export statement', () => {
    expect(read('export const a = 1, b = "two";', ['a', 'b'])).toEqual({
      a: 1,
      b: 'two',
    });
  });

  it('ignores export declarations without initializers', () => {
    expect(read('export let a;', ['a'])).toEqual({});
  });
});

describe('script kinds', () => {
  it('parses .tsx files', () => {
    const code = `
      const A = "a";
      export const X = A + "x";
      export default function C() { return <div />; }
    `;
    expect(read(code, ['X'], 'tsx')).toEqual({ X: 'ax' });
  });

  it('parses .jsx files', () => {
    const code = `
      const A = "a";
      export const X = A + "x";
      export default function C() { return <div />; }
    `;
    expect(read(code, ['X'], 'jsx')).toEqual({ X: 'ax' });
  });

  it('parses .js files', () => {
    expect(read('const A = 1; export const X = A + 1;', ['X'], 'js')).toEqual({
      X: 2,
    });
  });
});
