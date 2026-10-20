import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { readScriptMetadata } from './readScriptMetadata.js';

let base: string;
let counter = 0;

beforeAll(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'script-metadata-functions-'));
});

afterAll(() => {
  fs.rmSync(base, { recursive: true, force: true });
});

/** Single-file helper. */
function read(code: string, allow: string[]): Record<string, unknown> {
  return readFiles({ 'main.ts': code }, 'main.ts', allow);
}

/** Multi-file helper (relative path -> content). */
function readFiles(
  files: Record<string, string>,
  entry: string,
  allow: string[]
): Record<string, unknown> {
  const root = path.join(base, `project-${counter++}`);
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return readScriptMetadata(path.join(root, entry), allow);
}

describe('basic calls', () => {
  it('evaluates an arrow function applied to literals', () => {
    const code = `
      const c = (a, b) => a + " " + b;
      export const AB = c("Hello", "World");
    `;
    expect(read(code, ['AB'])).toEqual({ AB: 'Hello World' });
  });

  it('evaluates function declarations (hoisted, so order does not matter)', () => {
    const code = `
      export const AB = c("Hello", "World");
      function c(a: string, b: string): string {
        return a + " " + b;
      }
    `;
    expect(read(code, ['AB'])).toEqual({ AB: 'Hello World' });
  });

  it('evaluates function expressions', () => {
    const code = `
      const c = function (a, b) { return a + b; };
      export const X = c(1, 2);
    `;
    expect(read(code, ['X'])).toEqual({ X: 3 });
  });

  it('evaluates arguments that are other consts or call results', () => {
    const code = `
      const A = "Hello";
      const B = "World";
      const c = (a, b) => a + " " + b;
      const up = (s) => s + "!";
      export const X = c(A, up(B));
    `;
    expect(read(code, ['X'])).toEqual({ X: 'Hello World!' });
  });

  it('evaluates immediately-invoked functions', () => {
    expect(read('export const X = (() => "x")();', ['X'])).toEqual({ X: 'x' });
  });

  it('keeps TypeScript syntax working (types, generics, assertions)', () => {
    const code = `
      const id = <T,>(value: T): T => value;
      export const X = id<string>("a") satisfies string;
    `;
    expect(read(code, ['X'])).toEqual({ X: 'a' });
  });

  it('returns arrays and objects from functions', () => {
    const code = `
      const make = (name, n) => ({ name, list: [n, n + 1] });
      export const X = make("a", 1);
    `;
    expect(read(code, ['X'])).toEqual({ X: { name: 'a', list: [1, 2] } });
  });
});

describe('function bodies', () => {
  it('supports block bodies with local consts and return', () => {
    const code = `
      const c = (a, b) => {
        const sep = " ";
        const joined = a + sep + b;
        return joined + "!";
      };
      export const X = c("Hello", "World");
    `;
    expect(read(code, ['X'])).toEqual({ X: 'Hello World!' });
  });

  it('supports ternaries and comparisons', () => {
    const code = `
      const size = (n) => n > 3 ? "big" : "small";
      export const A = size(5);
      export const B = size(1);
      export const C = 1 === 1 ? "eq" : "ne";
      export const D = "a" < "b";
    `;
    expect(read(code, ['A', 'B', 'C', 'D'])).toEqual({
      A: 'big',
      B: 'small',
      C: 'eq',
      D: true,
    });
  });

  it('supports if / else if / else with early returns', () => {
    const code = `
      function sign(n) {
        if (n > 0) {
          return "positive";
        } else if (n < 0) {
          return "negative";
        }
        return "zero";
      }
      export const A = sign(5);
      export const B = sign(-5);
      export const C = sign(0);
    `;
    expect(read(code, ['A', 'B', 'C'])).toEqual({
      A: 'positive',
      B: 'negative',
      C: 'zero',
    });
  });

  it('supports nested function declarations (hoisted)', () => {
    const code = `
      function outer(a) {
        return inner(a);
        function inner(x) { return x + "!"; }
      }
      export const X = outer("a");
    `;
    expect(read(code, ['X'])).toEqual({ X: 'a!' });
  });

  it('only evaluates the branch that is taken', () => {
    const code = `
      const pick = (flag) => flag ? "a" : unknownFn();
      export const X = pick(true);
      export const Y = pick(false);
    `;
    expect(read(code, ['X', 'Y'])).toEqual({ X: 'a' });
  });

  it('short-circuits logical operators', () => {
    const code = `
      export const A = "a" || foo();
      export const B = false && foo();
      export const C = null ?? foo();
    `;
    expect(read(code, ['A', 'B', 'C'])).toEqual({ A: 'a', B: false });
  });
});

describe('parameters', () => {
  it('supports default values, including ones that use earlier parameters', () => {
    const code = `
      const c = (a, b = "World") => a + " " + b;
      const d = (a, b = a + "!") => b;
      export const A = c("Hello");
      export const B = c("Hi", "There");
      export const C = d("x");
    `;
    expect(read(code, ['A', 'B', 'C'])).toEqual({
      A: 'Hello World',
      B: 'Hi There',
      C: 'x!',
    });
  });

  it('supports rest parameters and spread arguments', () => {
    const code = `
      const f = (first, ...rest) => rest;
      export const A = f(1, 2, 3);
      export const B = f(...[1, 2, 3]);
    `;
    expect(read(code, ['A', 'B'])).toEqual({ A: [2, 3], B: [2, 3] });
  });

  it('lets parameters shadow top-level names', () => {
    const code = `
      const a = "outer";
      const f = (a) => a + "!";
      export const X = f("inner");
    `;
    expect(read(code, ['X'])).toEqual({ X: 'inner!' });
  });

  it('lets functions see top-level consts declared later', () => {
    const code = `
      const f = () => b;
      export const X = f();
      const b = "b";
    `;
    expect(read(code, ['X'])).toEqual({ X: 'b' });
  });

  it('passes an unresolvable argument through if the function ignores it', () => {
    const code = `
      const first = (a, b) => a;
      export const X = first("x", foo());
    `;
    expect(read(code, ['X'])).toEqual({ X: 'x' });
  });

  it('omits the result when an unresolvable argument is actually used', () => {
    const code = `
      const add = (a, b) => a + b;
      export const X = add("x", foo());
      export const Y = add("x");
    `;
    expect(read(code, ['X', 'Y'])).toEqual({});
  });

  it('omits the result when an unresolvable argument meets a default value', () => {
    const code = `export const X = ((a = "d") => a)(foo());`;
    expect(read(code, ['X'])).toEqual({});
  });
});

describe('closures and higher-order functions', () => {
  it('supports currying and partial application', () => {
    const code = `
      const add = (a) => (b) => a + b;
      const add5 = add(5);
      export const X = add(1)(2);
      export const Y = add5(1);
    `;
    expect(read(code, ['X', 'Y'])).toEqual({ X: 3, Y: 6 });
  });

  it('supports functions passed as arguments', () => {
    const code = `
      const twice = (f, x) => f(f(x));
      export const X = twice((s) => s + "!", "a");
    `;
    expect(read(code, ['X'])).toEqual({ X: 'a!!' });
  });

  it('supports recursion', () => {
    const code = `
      function fact(n) {
        if (n <= 1) { return 1; }
        return n * fact(n - 1);
      }
      const fib = (n) => n < 2 ? n : fib(n - 1) + fib(n - 2);
      export const A = fact(5);
      export const B = fib(10);
    `;
    expect(read(code, ['A', 'B'])).toEqual({ A: 120, B: 55 });
  });

  it('supports named function expressions calling themselves', () => {
    const code = `
      const f = function down(n) { return n <= 0 ? "done" : down(n - 1); };
      export const X = f(3);
    `;
    expect(read(code, ['X'])).toEqual({ X: 'done' });
  });
});

describe('functions across modules', () => {
  it('calls imported functions, evaluated in their own module scope', () => {
    const files = {
      'fn.ts': `
        const SEP = "-";
        export const join = (a, b) => a + SEP + b;
      `,
      'main.ts': `
        import { join } from './fn';
        export const X = join("a", "b");
      `,
    };
    expect(readFiles(files, 'main.ts', ['X'])).toEqual({ X: 'a-b' });
  });

  it('calls functions through a namespace import', () => {
    const files = {
      'fn.ts': `export function join(a, b) { return a + b; }`,
      'main.ts': `
        import * as F from './fn';
        export const X = F.join("a", "b");
      `,
    };
    expect(readFiles(files, 'main.ts', ['X'])).toEqual({ X: 'ab' });
  });

  it('calls default-exported functions (named and anonymous)', () => {
    const files = {
      'named.ts': `export default function shout(s) { return s + "!"; }`,
      'anon.ts': `export default function (s) { return s + "?"; }`,
      'main.ts': `
        import shout from './named';
        import ask from './anon';
        export const X = shout("a") + ask("b");
      `,
    };
    expect(readFiles(files, 'main.ts', ['X'])).toEqual({ X: 'a!b?' });
  });

  it('calls functions re-exported through a barrel', () => {
    const files = {
      'fn.ts': `export const join = (a, b) => a + b;`,
      'barrel.ts': `export { join } from './fn';`,
      'main.ts': `
        import { join } from './barrel';
        export const X = join("a", "b");
      `,
    };
    expect(readFiles(files, 'main.ts', ['X'])).toEqual({ X: 'ab' });
  });

  it('lets a function use imports from its own module', () => {
    const files = {
      'consts.ts': `export const PREFIX = "api";`,
      'fn.ts': `
        import { PREFIX } from './consts';
        export const route = (name) => PREFIX + "/" + name;
      `,
      'main.ts': `
        import { route } from './fn';
        export const X = route("users");
      `,
    };
    expect(readFiles(files, 'main.ts', ['X'])).toEqual({ X: 'api/users' });
  });
});

describe('functions are never part of the metadata', () => {
  it('omits exported functions', () => {
    const code = `
      export const f = (a) => a;
      export function g() { return 1; }
    `;
    expect(read(code, ['f', 'g'])).toEqual({});
  });

  it('drops function-valued properties and array elements', () => {
    const code = `
      export const o = { a: 1, f: () => 1 };
      export const l = [1, () => 1];
    `;
    expect(read(code, ['o', 'l'])).toEqual({ o: { a: 1 }, l: [1, undefined] });
  });
});

describe('things that must not be evaluated', () => {
  it('omits calls of things that are not functions', () => {
    expect(read('const A = 1; export const X = A();', ['X'])).toEqual({});
  });

  it('omits calls to unknown functions', () => {
    expect(read('export const X = foo("a");', ['X'])).toEqual({});
  });

  it('bails out on side effects it cannot model', () => {
    const code = `
      let counter = 0;
      function unknownCall() { sideEffects(); return 1; }
      function touchesModuleState() { counter++; return 1; }
      function assignsModuleState() { counter = 5; return 1; }
      function assignsConst() { const x = 1; x = 2; return x; }
      function assignsProperty() { const o = { a: 1 }; o.a = 2; return 1; }
      export const A = unknownCall();
      export const B = touchesModuleState();
      export const C = assignsModuleState();
      export const D = assignsConst();
      export const E = assignsProperty();
    `;
    expect(read(code, ['A', 'B', 'C', 'D', 'E'])).toEqual({});
  });

  it('bails out on constructs it cannot model', () => {
    const code = `
      function usesVar() { var x = 1; return x; }
      function usesSwitch() { switch (1) { default: return 1; } }
      function usesTry() { try { return 1; } catch { return 2; } }
      function usesLabel() { outer: for (;;) { break outer; } return 1; }
      function nestedAssign() { let x = 0; return x = 5; }
      function forIn() { for (const k in { a: 1 }) { return 1; } return 2; }
      export const A = usesVar();
      export const B = usesSwitch();
      export const C = usesTry();
      export const D = usesLabel();
      export const E = nestedAssign();
      export const F = forIn();
    `;
    expect(read(code, ['A', 'B', 'C', 'D', 'E', 'F'])).toEqual({});
  });

  it('omits async functions, generators and destructured parameters', () => {
    const code = `
      const a = async () => "a";
      function* g() { return 1; }
      const d = ({ x }) => x;
      export const A = a();
      export const B = g();
      export const C = d({ x: 1 });
    `;
    expect(read(code, ['A', 'B', 'C'])).toEqual({});
  });

  it('omits method calls on values (not supported)', () => {
    expect(read('export const X = "a".toUpperCase();', ['X'])).toEqual({});
  });
});

describe('termination', () => {
  it('gives up on infinite recursion', () => {
    expect(read('const f = () => f(); export const X = f();', ['X'])).toEqual({});
  });

  it('gives up on infinite recursion through default values', () => {
    const code = `const f = (a = f()) => a; export const X = f();`;
    expect(read(code, ['X'])).toEqual({});
  });

  it('gives up when a value depends on itself through a function', () => {
    const code = `
      export const A = f();
      function f() { return A; }
    `;
    expect(read(code, ['A'])).toEqual({});
  });

  it('gives up on calls that exceed the call budget without blocking other values', () => {
    const code = `
      function fib(n) {
        if (n < 2) { return n; }
        return fib(n - 1) + fib(n - 2);
      }
      export const SMALL = fib(10);
      export const BIG = fib(30);
    `;
    expect(read(code, ['SMALL', 'BIG'])).toEqual({ SMALL: 55 });
  });
});

describe('local mutation and loops', () => {
  it('supports a loop that always yields a static value', () => {
    const code = `
      function loop() { for (let i = 0; i < 3; i++) {} return 1; }
      export const A = loop();
    `;
    expect(read(code, ['A'])).toEqual({ A: 1 });
  });

  it('supports local let and reassignment', () => {
    const code = `
      function mutable() { let x = 1; return x; }
      function reassign(a) { a = a + 1; return a; }
      function declaredLater() { let x; x = 5; return x; }
      export const A = mutable();
      export const B = reassign(1);
      export const C = declaredLater();
    `;
    expect(read(code, ['A', 'B', 'C'])).toEqual({ A: 1, B: 2, C: 5 });
  });

  it('supports compound assignment and ++/--', () => {
    const code = `
      function f() {
        let n = 10;
        n += 5; n -= 3; n *= 2; n /= 4; n %= 4; n **= 2;
        n++; ++n; n--;
        return n;
      }
      function s() { let s = "a"; s += "b"; s += 1; return s; }
      export const A = f();
      export const B = s();
    `;
    // 10 -> 15 -> 12 -> 24 -> 6 -> 2 -> 4 -> 5 -> 6 -> 5
    expect(read(code, ['A', 'B'])).toEqual({ A: 5, B: 'ab1' });
  });

  it('supports for loops that accumulate', () => {
    const code = `
      function sum(n) {
        let total = 0;
        for (let i = 1; i <= n; i++) { total += i; }
        return total;
      }
      function concat() {
        let s = "";
        for (let i = 0; i < 3; i++) { s += i; }
        return s;
      }
      function twoVars() {
        let t = 0;
        for (let i = 0, j = 10; i < j; i++, j--) { t += 1; }
        return t;
      }
      function nested() {
        let t = 0;
        for (let i = 1; i <= 3; i++) {
          for (let j = 1; j <= 3; j++) { t += i * j; }
        }
        return t;
      }
      export const A = sum(10);
      export const B = concat();
      export const C = twoVars();
      export const D = nested();
    `;
    expect(read(code, ['A', 'B', 'C', 'D'])).toEqual({
      A: 55,
      B: '012',
      C: 5,
      D: 36,
    });
  });

  it('supports while and do-while loops', () => {
    const code = `
      function w() { let x = 1; while (x < 100) { x *= 2; } return x; }
      function d() { let x = 10; do { x -= 3; } while (x > 0); return x; }
      function once() { let x = 0; do { x++; } while (false); return x; }
      export const A = w();
      export const B = d();
      export const C = once();
    `;
    expect(read(code, ['A', 'B', 'C'])).toEqual({ A: 128, B: -2, C: 1 });
  });

  it('supports for...of over arrays and strings', () => {
    const code = `
      function sum(list) {
        let t = 0;
        for (const n of list) { t += n; }
        return t;
      }
      function reverse() {
        let out = "";
        for (const ch of "abc") { out = ch + out; }
        return out;
      }
      export const A = sum([1, 2, 3]);
      export const B = reverse();
    `;
    expect(read(code, ['A', 'B'])).toEqual({ A: 6, B: 'cba' });
  });

  it('supports break, continue and early return from loops', () => {
    const code = `
      function f() {
        let t = 0;
        for (let i = 0; i < 10; i++) {
          if (i === 2) { continue; }
          if (i === 5) { break; }
          t += i;
        }
        return t;
      }
      function find(limit) {
        for (let i = 0; i < 100; i++) {
          if (i * i > limit) { return i; }
        }
        return -1;
      }
      export const A = f();
      export const B = find(50);
    `;
    expect(read(code, ['A', 'B'])).toEqual({ A: 8, B: 8 });
  });

  it('lets closures mutate variables they captured', () => {
    const code = `
      function f() {
        let n = 0;
        const inc = () => { n += 2; };
        inc();
        inc();
        return n;
      }
      export const A = f();
    `;
    expect(read(code, ['A'])).toEqual({ A: 4 });
  });

  it('gives each for-loop iteration its own copy of the loop variable', () => {
    const code = `
      function f() {
        let g;
        for (let i = 0; i < 3; i++) {
          if (i === 1) { g = () => i; }
        }
        return g();
      }
      export const A = f();
    `;
    expect(read(code, ['A'])).toEqual({ A: 1 });
  });

  it('keeps loop variables scoped to the loop', () => {
    const code = `
      const i = "outer";
      function f() {
        for (let i = 0; i < 3; i++) {}
        return i;
      }
      export const A = f();
    `;
    expect(read(code, ['A'])).toEqual({ A: 'outer' });
  });

  it('omits the result when a loop condition cannot be resolved', () => {
    const code = `
      function f() { let i = 0; while (unknown()) { i++; } return i; }
      export const A = f();
    `;
    expect(read(code, ['A'])).toEqual({});
  });

  it('gives up on endless loops, without starving other properties', () => {
    const code = `
      function spin() { while (true) {} return 1; }
      function ok() {
        let t = 0;
        for (let i = 0; i < 10; i++) { t += i; }
        return t;
      }
      export const A = spin();
      export const B = ok();
    `;
    expect(read(code, ['A', 'B'])).toEqual({ B: 45 });
  });
});
