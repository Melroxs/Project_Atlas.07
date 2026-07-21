import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    rules:{
      'no-console':'warn',
      'no-undef':'off',
      'no-unused-vars':'off',
    },
  },
  {
    files:['**/*.ts','**/*.tsx'],
    languageOptions:{
      parser:tsParser,
      parserOptions:{
        project:['./tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins:{
      '@typescript-eslint': tsPlugin,
    },
    rules:{
      '@typescript-eslint/no-unused-vars':'warn',
    },
  },
  {
    files:['apps/web/src/**/*.{js,jsx}'],
    languageOptions:{
      parser: tsParser,
      parserOptions:{
        jsx: true,
        ecmaFeatures: { jsx: true },
      },
      globals: globals.browser,
    },
  },
  {
    files:['apps/api/**/*.{js,ts}', 'apps/api/tests/**/*.{js,ts}'],
    languageOptions:{
      globals: {
        ...globals.node,
        ...globals.jest,
        ...globals.commonjs,
      },
    },
    rules:{
      'no-case-declarations':'off',
    },
  },
  {
    ignores:[
      'node_modules/',
      'dist/',
      '**/dist/',
      'apps/api/dist/',
      'apps/api/.tsbuildinfo',
      'build/',
      '.next/',
      '.turbo/',
    ],
  },
];
