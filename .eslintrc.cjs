const { builtinModules } = require('module');

const ALLOWED_NODE_BUILTINS = new Set(['assert']);

// Packages banned from workflow-context files — they break determinism or the V8 bundle.
const WORKFLOW_BANNED_PACKAGES = [
  '@temporalio/client',
  '@temporalio/worker',
  '@temporalio/activity',
  'dotenv',
  'dotenv/config',
];

// Files that run inside Temporal's V8 workflow sandbox — must stay bundle-safe.
// Kept in sync with the workflow-safe subpath export (src/core/workflow-exports.ts).
const WORKFLOW_FILES = [
  'src/core/signals.ts',
  'src/core/utils.ts',
  'src/core/updates.ts',
  'src/core/proxy.ts',
  'src/core/wait-with-timeout.ts',
  'src/core/workflow-exports.ts',
  'src/core/__fixtures__/*.ts',
];

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  env: {
    node: true,
    es2021: true,
    jest: true,
  },
  rules: {
    // forgetting to await Activities and Workflow APIs is bad
    '@typescript-eslint/no-floating-promises': 'error',
    'object-shorthand': ['error', 'always'],
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    '@typescript-eslint/no-explicit-any': 'off',
    // Enforce import type for type-only imports — critical for workflow files where
    // a value import pulls in Node.js code and breaks the V8 bundle.
    '@typescript-eslint/consistent-type-imports': [
      'error',
      { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
    ],
  },
  overrides: [
    {
      files: WORKFLOW_FILES,
      rules: {
        'no-restricted-imports': [
          'error',
          // All Node.js builtins (except assert which is safe in V8)
          ...builtinModules
            .filter((m) => !ALLOWED_NODE_BUILTINS.has(m))
            .flatMap((m) => [m, `node:${m}`]),
          // Temporal packages that import Node.js — banned from workflow bundle
          ...WORKFLOW_BANNED_PACKAGES,
        ],
      },
    },
  ],
  ignorePatterns: ['dist', 'node_modules'],
};
