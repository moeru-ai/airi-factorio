import antfu from '@antfu/eslint-config'

export default antfu({
  rules: {
    'ts/naming-convention': 'off',
  },
  yaml: false,
  markdown: false,
}, {
  rules: {
    'ts/naming-convention': 'error',
  },
  files: ['**/*.ts'],
  ignores: ['eslint.config.ts'],
}, {
  rules: {
    'ts/naming-convention': [
      'error',
      {
        selector: [
          'property',
          'parameter',
          'variable',
        ],
        format: ['snake_case'],
      },
    ],
    // rule conflict with ts/naming-convention when using snake_case
    'unused-imports/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^unused_',
        destructuredArrayIgnorePattern: '^unused_',
      },
    ],
  },
  files: [
    'packages/autorio/**/*.ts',
    'packages/tstl-plugin-reload-mod/**/*.ts',
  ],
})
