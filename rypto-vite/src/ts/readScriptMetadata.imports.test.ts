import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type ts from 'typescript';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { readScriptMetadata } from './readScriptMetadata.js';

let base: string;
let counter = 0;

beforeAll(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'script-metadata-imports-'));
});

afterAll(() => {
  fs.rmSync(base, { recursive: true, force: true });
});

/**
 * Writes `files` (relative path -> content) into a fresh directory and reads
 * the metadata of `entry`.
 */
function read(
  files: Record<string, string>,
  entry: string,
  allow: string[],
  compilerOptions?: (root: string) => ts.CompilerOptions
): Record<string, unknown> {
  const root = path.join(base, `project-${counter++}`);
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(root, relative);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  return readScriptMetadata(
    path.join(root, entry),
    allow,
    compilerOptions ? { compilerOptions: compilerOptions(root) } : undefined
  );
}

describe('named imports', () => {
  it('resolves named imports from a relative file', () => {
    const files = {
      'consts.ts': `export const A = "Hello"; export const B = "World";`,
      'main.ts': `
        import { A, B } from './consts';
        export const AB = A + " " + B;
      `,
    };
    expect(read(files, 'main.ts', ['AB'])).toEqual({ AB: 'Hello World' });
  });

  it('supports aliased imports', () => {
    const files = {
      'consts.ts': `export const A = "Hello";`,
      'main.ts': `
        import { A as Greeting } from './consts';
        export const X = Greeting + "!";
      `,
    };
    expect(read(files, 'main.ts', ['X'])).toEqual({ X: 'Hello!' });
  });

  it('supports imported values inside objects, arrays and templates', () => {
    const files = {
      'consts.ts': `export const HOST = "localhost"; export const PORT = 8080;`,
      'main.ts': `
        import { HOST, PORT } from './consts';
        export const config = {
          HOST,
          url: \`http://\${HOST}:\${PORT}\`,
          ports: [PORT, PORT + 1],
        };
      `,
    };
    expect(read(files, 'main.ts', ['config'])).toEqual({
      config: {
        HOST: 'localhost',
        url: 'http://localhost:8080',
        ports: [8080, 8081],
      },
    });
  });

  it('evaluates imported values in the scope of the module that defines them', () => {
    const files = {
      'consts.ts': `
        const PREFIX = "api";
        export const BASE = PREFIX + "/v1";
      `,
      'main.ts': `
        import { BASE } from './consts';
        export const X = BASE + "/users";
      `,
    };
    expect(read(files, 'main.ts', ['X'])).toEqual({ X: 'api/v1/users' });
  });

  it('follows chains of imports across several files', () => {
    const files = {
      'c.ts': `export const C = "c";`,
      'b.ts': `import { C } from './c'; export const B = C + "b";`,
      'a.ts': `import { B } from './b'; export const A = B + "a";`,
    };
    expect(read(files, 'a.ts', ['A'])).toEqual({ A: 'cba' });
  });
});

describe('default and namespace imports', () => {
  it('resolves default imports', () => {
    const files = {
      'greeting.ts': `export default "hi";`,
      'main.ts': `
        import greeting from './greeting';
        export const X = greeting + "!";
      `,
    };
    expect(read(files, 'main.ts', ['X'])).toEqual({ X: 'hi!' });
  });

  it('resolves `export { A as default }`', () => {
    const files = {
      'greeting.ts': `const A = "hey"; export { A as default };`,
      'main.ts': `import g from './greeting'; export const X = g;`,
    };
    expect(read(files, 'main.ts', ['X'])).toEqual({ X: 'hey' });
  });

  it('resolves namespace member access', () => {
    const files = {
      'consts.ts': `export const A = "a"; export const B = "b";`,
      'main.ts': `
        import * as C from './consts';
        export const X = C.A + C["B"];
      `,
    };
    expect(read(files, 'main.ts', ['X'])).toEqual({ X: 'ab' });
  });

  it('omits a bare namespace identifier and unknown members', () => {
    const files = {
      'consts.ts': `export const A = "a";`,
      'main.ts': `
        import * as C from './consts';
        export const X = C;
        export const Y = C.nope;
      `,
    };
    expect(read(files, 'main.ts', ['X', 'Y'])).toEqual({});
  });
});

describe('exports and re-exports', () => {
  it('supports `export { A }` and `export { A as B }` in the entry file', () => {
    const files = {
      'main.ts': `
        const A = 1;
        const B = "b";
        export { A, B as renamed };
      `,
    };
    expect(read(files, 'main.ts', ['A', 'renamed', 'B'])).toEqual({
      A: 1,
      renamed: 'b',
    });
  });

  it('supports `export default <expression>` in the entry file', () => {
    const files = { 'main.ts': `export default { a: 1 };` };
    expect(read(files, 'main.ts', ['default'])).toEqual({ default: { a: 1 } });
  });

  it('exposes re-exports from the entry file', () => {
    const files = {
      'consts.ts': `export const A = "a";`,
      'main.ts': `export { A, A as Z } from './consts';`,
    };
    expect(read(files, 'main.ts', ['A', 'Z'])).toEqual({ A: 'a', Z: 'a' });
  });

  it('follows named re-exports through an intermediate module', () => {
    const files = {
      'consts.ts': `export const A = "a";`,
      'barrel.ts': `export { A as B } from './consts';`,
      'main.ts': `import { B } from './barrel'; export const X = B + "!";`,
    };
    expect(read(files, 'main.ts', ['X'])).toEqual({ X: 'a!' });
  });

  it('follows `export *` and does not re-export default through it', () => {
    const files = {
      'consts.ts': `export const A = "a"; export default "d";`,
      'barrel.ts': `export * from './consts';`,
      'main.ts': `
        import { A } from './barrel';
        import d from './barrel';
        export const X = A;
        export const Y = d;
      `,
    };
    expect(read(files, 'main.ts', ['X', 'Y'])).toEqual({ X: 'a' });
  });

  it('prefers a local export over `export *`', () => {
    const files = {
      'consts.ts': `export const A = "star";`,
      'barrel.ts': `export * from './consts'; export const A = "local";`,
      'main.ts': `import { A } from './barrel'; export const X = A;`,
    };
    expect(read(files, 'main.ts', ['X'])).toEqual({ X: 'local' });
  });

  it('re-exports an imported binding', () => {
    const files = {
      'consts.ts': `export const A = "a";`,
      'barrel.ts': `import { A } from './consts'; export { A };`,
      'main.ts': `import { A } from './barrel'; export const X = A;`,
    };
    expect(read(files, 'main.ts', ['X'])).toEqual({ X: 'a' });
  });
});

describe('module resolution', () => {
  it('resolves explicit extensions, including `.js` pointing at a `.ts` file', () => {
    const files = {
      'consts.ts': `export const A = "a";`,
      'main.ts': `
        import { A } from './consts.js';
        export const X = A;
      `,
    };
    expect(read(files, 'main.ts', ['X'])).toEqual({ X: 'a' });
  });

  it('resolves directory imports through index files', () => {
    const files = {
      'lib/index.ts': `export const A = "a";`,
      'main.ts': `import { A } from './lib'; export const X = A;`,
    };
    expect(read(files, 'main.ts', ['X'])).toEqual({ X: 'a' });
  });

  it('resolves parent-directory imports', () => {
    const files = {
      'shared.ts': `export const A = "a";`,
      'nested/main.ts': `import { A } from '../shared'; export const X = A;`,
    };
    expect(read(files, 'nested/main.ts', ['X'])).toEqual({ X: 'a' });
  });

  it('resolves .js and .tsx dependencies', () => {
    const files = {
      'plain.js': `export const A = "js";`,
      'view.tsx': `export const B = "tsx"; export default () => <div />;`,
      'main.ts': `
        import { A } from './plain';
        import { B } from './view';
        export const X = A + B;
      `,
    };
    expect(read(files, 'main.ts', ['X'])).toEqual({ X: 'jstsx' });
  });

  it('honors tsconfig-style `paths` passed via compilerOptions', () => {
    const files = {
      'lib/consts.ts': `export const A = "a";`,
      'main.ts': `import { A } from '@lib/consts'; export const X = A;`,
    };
    const result = read(files, 'main.ts', ['X'], (root) => ({
      baseUrl: root,
      paths: { '@lib/*': ['lib/*'] },
    }));
    expect(result).toEqual({ X: 'a' });
  });

  it('omits values from bare package specifiers', () => {
    const files = {
      'main.ts': `import { A } from 'some-package'; export const X = A;`,
    };
    expect(read(files, 'main.ts', ['X'])).toEqual({});
  });

  it('omits values from files that do not exist, without throwing', () => {
    const files = {
      'main.ts': `import { A } from './missing'; export const X = A; export const Y = 1;`,
    };
    expect(read(files, 'main.ts', ['X', 'Y'])).toEqual({ Y: 1 });
  });
});

describe('things that must not be resolved', () => {
  it('omits non-exported constants of the imported module', () => {
    const files = {
      'consts.ts': `const SECRET = "s"; export const PUBLIC = "p";`,
      'main.ts': `import { SECRET } from './consts'; export const X = SECRET;`,
    };
    expect(read(files, 'main.ts', ['X'])).toEqual({});
  });

  it('omits imported let/var', () => {
    const files = {
      'consts.ts': `export let A = 1; export var B = 2;`,
      'main.ts': `
        import { A, B } from './consts';
        export const X = A;
        export const Y = B;
      `,
    };
    expect(read(files, 'main.ts', ['X', 'Y'])).toEqual({});
  });

  it('omits imported values that are not statically computable', () => {
    const files = {
      'consts.ts': `export const A = compute();`,
      'main.ts': `import { A } from './consts'; export const X = "x" + A;`,
    };
    expect(read(files, 'main.ts', ['X'])).toEqual({});
  });

  it('omits names the target module does not export', () => {
    const files = {
      'consts.ts': `export const A = 1;`,
      'main.ts': `import { B } from './consts'; export const X = B;`,
    };
    expect(read(files, 'main.ts', ['X'])).toEqual({});
  });

  it('ignores type-only imports and exports', () => {
    const files = {
      'types.ts': `export type T = string; export const A = "a";`,
      'main.ts': `
        import type { T } from './types';
        import { type T as U, A } from './types';
        export type { T };
        export const X: T = A;
      `,
    };
    expect(read(files, 'main.ts', ['X'])).toEqual({ X: 'a' });
  });
});

describe('cycles', () => {
  it('does not hang on mutually dependent values', () => {
    const files = {
      'a.ts': `import { B } from './b'; export const A = B + "a";`,
      'b.ts': `import { A } from './a'; export const B = A + "b";`,
    };
    expect(read(files, 'a.ts', ['A'])).toEqual({});
  });

  it('still resolves values in a circular import graph when they are not circular themselves', () => {
    const files = {
      'a.ts': `import { B } from './b'; export const A = B;`,
      'b.ts': `import { A } from './a'; export const B = "b"; export const C = A;`,
    };
    expect(read(files, 'a.ts', ['A'])).toEqual({ A: 'b' });
  });

  it('does not hang on `export *` cycles', () => {
    const files = {
      'a.ts': `export * from './b';`,
      'b.ts': `export * from './a';`,
      'main.ts': `import { X } from './a'; export const Y = X;`,
    };
    expect(read(files, 'main.ts', ['Y'])).toEqual({});
  });
});
