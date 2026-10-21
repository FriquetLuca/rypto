import { defineConfig } from 'tsdown';

export default defineConfig([
  {
    entry: {
      index: 'src/neutral/index.ts',
    },
    root: 'src',
    outDir: 'dist/neutral',
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
    minify: true,
    unbundle: false,
    treeshake: true,
  },
  {
    entry: {
      node: 'src/node/index.ts',
    },
    root: 'src',
    outDir: 'dist/node',
    platform: 'node',
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
    minify: true,
    unbundle: false,
    treeshake: true,
  },
]);
