// ==========================================================
// Atlas
// apps/api/jest.config.js
// ==========================================================
// Minimal jest config so TypeScript unit tests run with ts-jest.
// (Jest is the established test runner in apps/api; ts-jest
//  provides the TS transform so `npm test` works.)
//
// NOTE: the legacy integration tests in tests/ (companies,
// interviews) require Supabase env vars at import time and will
// fail without them — they are pre-existing, not affected here.

/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  // Prefer TS sources over stale compiled .js twins in src/ (legacy
  // `tsc` output with outdated relative imports would otherwise be
  // resolved by jest and break the legacy integration suites).
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  // Workspace packages ship an `exports` field pointing at TypeScript
  // source (no `main`), which legacy ts-jest module resolution won't
  // follow. Map them to their source entry so unit tests can import
  // the domain + database packages directly. `paths` makes ts-jest's
  // compiler resolve them; `moduleNameMapper` makes the runtime `require`
  // resolve them.
  moduleNameMapper: {
    '^@project-atlas/database$': '<rootDir>/../../packages/database/src/index.ts',
    '^@project-atlas/ai$': '<rootDir>/../../packages/ai/src/index.ts',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          target: 'es2022',
          module: 'commonjs',
          moduleResolution: 'node',
          esModuleInterop: true,
          strict: true,
          skipLibCheck: true,
          resolveJsonModule: true,
          allowJs: true,
          baseUrl: '../..',
          paths: {
            '@project-atlas/database': ['packages/database/src/index.ts'],
            '@project-atlas/ai': ['packages/ai/src/index.ts'],
          },
        },
      },
    ],
  },
  testMatch: ['**/*.test.ts'],
};
