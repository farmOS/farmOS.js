import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

const dist = 'dist/';
const umd = `${dist}umd/`;
const cjs = `${dist}cjs/`;
const esm = `${dist}esm/`;
const ramda = /ramda|ramda\/src\/.*/;

export default [
  // browser-friendly UMD build
  {
    input: 'src/index.js',
    output: {
      name: 'farmOS',
      file: `${umd}farmOS.js`,
      format: 'umd',
      exports: 'named',
    },
    plugins: [
      json(),
      resolve({
        jsnext: true,
        preferBuiltins: true,
        browser: true,
      }), // so Rollup can find dependencies
      commonjs(), // so Rollup can convert dependencies to an ES module
    ],
  },
  {
    input: 'src/model/index.js',
    output: {
      name: 'model',
      file: `${umd}model.js`,
      format: 'umd',
      exports: 'named',
    },
    plugins: [
      json(),
      resolve(), // so Rollup can find dependencies
      commonjs(), // so Rollup can convert dependencies to an ES module
    ],
  },
  {
    input: 'src/client/index.js',
    output: {
      name: 'client',
      file: `${umd}client.js`,
      format: 'umd',
      exports: 'named',
    },
    plugins: [
      json(),
      resolve({
        jsnext: true,
        preferBuiltins: true,
        browser: true,
      }), // so Rollup can find dependencies
      commonjs(), // so Rollup can convert dependencies to an ES module
    ],
  },
  {
    input: 'src/entities.js',
    output: {
      name: 'entities',
      file: `${umd}entities.js`,
      format: 'umd',
      exports: 'named',
    },
    plugins: [
      json(),
      resolve(), // so Rollup can find dependencies
      commonjs(), // so Rollup can convert dependencies to an ES module
    ],
  },

  // CommonJS (for Node) and ES module (for bundlers) build.
  // (We could have three entries in the configuration array
  // instead of two, but it's quicker to generate multiple
  // builds from a single configuration where possible, using
  // an array for the `output` option, where we can specify
  // `file` and `format` for each target)
  {
    input: 'src/index.js',
    external: ['axios', ramda, 'uuid'],
    output: [
      { file: `${cjs}farmOS.js`, format: 'cjs', exports: 'named' },
      { file: `${esm}farmOS.js`, format: 'es' },
    ],
  },
  {
    input: 'src/model/index.js',
    external: ['axios', ramda, 'uuid'],
    output: [
      { file: `${cjs}model.js`, format: 'cjs', exports: 'named' },
      { file: `${esm}model.js`, format: 'es' },
    ],
  },
  {
    input: 'src/client/index.js',
    external: ['axios', ramda, 'uuid'],
    output: [
      { file: `${cjs}client.js`, format: 'cjs', exports: 'named' },
      { file: `${esm}client.js`, format: 'es' },
    ],
  },
  {
    input: 'src/entities.js',
    external: [ramda],
    output: [
      { file: `${cjs}entities.js`, format: 'cjs', exports: 'named' },
      { file: `${esm}entities.js`, format: 'es' },
    ],
  },
  {
    input: 'src/client/parse-filter.js',
    output: [
      { file: `${cjs}parse-filter.js`, format: 'cjs', exports: 'named' },
      { file: `${esm}parse-filter.js`, format: 'es' },
    ],
  },
  {
    input: 'src/json-schema/index.js',
    external: ['axios', ramda, 'uuid'],
    output: [
      { file: `${cjs}json-schema.js`, format: 'cjs', exports: 'named' },
      { file: `${esm}json-schema.js`, format: 'es' },
    ],
  },
];
