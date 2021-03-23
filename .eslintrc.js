module.exports = {
  env: {
    browser: true,
    es6: true,
    node: true,
    mocha: true,
  },
  extends: 'airbnb-base',
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  rules: {
    'implicit-arrow-linebreak': 'off',
    'no-underscore-dangle': 'off',
  },
  overrides: [
    {
      files: ['test/**'],
      rules: {
        strict: 'off',
        'no-unused-expressions': 'off',
      },
    },
  ],
};
