import antfu from '@antfu/eslint-config'

export default antfu({
  rules: {
    'ts/naming-convention': [
      'error',
      {
        selector: [
          'property',
          'parameter',
          'variable'
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
      }
    ]
  },
})

