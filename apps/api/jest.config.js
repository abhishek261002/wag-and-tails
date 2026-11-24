module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  moduleNameMapper: {
    // Source files import siblings as './x.js' (ESM style); in tests resolve those to the .ts file.
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@wag/config$': '<rootDir>/../../packages/config/src/index.ts',
    '^@wag/shared-types$': '<rootDir>/../../packages/shared-types/src/index.ts',
    '^@wag/validation$': '<rootDir>/../../packages/validation/src/index.ts',
  },
  testMatch: ['**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: { module: 'CommonJS' } }],
  },
};
