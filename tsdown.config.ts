import { defineConfig } from 'tsdown';

export default defineConfig({
  /*
  entry: {
    // Maps src/foo.ts → dist/lib/foo.js, src/bar.ts → dist/lib/bar.js
    'lib/*': 'src/*.ts',
    // Include all hooks except the index file
    'hooks/*': ['src/hooks/*.ts', '!src/hooks/index.ts'],
    'utils/*': [
      'src/utils/*.ts',
      'src/utils/*.tsx',
      '!src/utils/index.ts',
      '!src/utils/internal.ts',
    ],
  },
  deps: {
    neverBundle: ['lodash', /^@my-scope\//],
    alwaysBundle: ['some-package'],
    onlyBundle: ['cac', 'bumpp'],
    onlyImport: ['cac'],
    resolveDepSubpath: true,
  },
  */
  entry: ['src/**/*.ts', '!src/**/*.test.ts'],
  root: 'src',
  platform: 'neutral',
  format: {
    esm: {
      target: ['es2023'],
    },
    cjs: {
      target: ['node20'],
    },
  },
  dts: {
    generator: 'tsc',
  },
  exports: true,
  minify: true,
  unbundle: true,
  treeshake: true,
});
