import antfu from '@antfu/eslint-config'

export default antfu(
  // #region naming-convention
  {
    rules: {
      'ts/naming-convention': 'off',
    },
    yaml: false,
    markdown: false,
  },
  {
    rules: {
      'ts/naming-convention': 'error',
    },
    files: ['**/*.ts'],
    ignores: ['eslint.config.ts', 'apps/factorio-yolo-v0-playground/uno.config.ts'],
  },
  {
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
      'packages/tstl-plugin-reload-factorio-mod/example/*.ts',
      'packages/factorio-rcon-snippets-for-vscode/**/*.ts',
      'apps/factorio-yolo-v0-playground/src/workers/vlm-play-worker.ts',
    ],
  },
  // #endregion
  // #region no-console
  {
    rules: {
      'no-console': 'off',
    },
    files: ['packages/vscode-factorio-rcon-evaluator/**/*.ts'],
  },
  // #endregion
  // #global-ignore
  {
    ignores: ['models/*', '**/.pixi'],
  },
  // #endregion
)
