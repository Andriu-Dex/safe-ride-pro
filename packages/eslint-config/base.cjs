module.exports = {
  root: false,
  env: {
    es2024: true,
    node: true,
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  extends: ['eslint:recommended'],
  rules: {
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
};
