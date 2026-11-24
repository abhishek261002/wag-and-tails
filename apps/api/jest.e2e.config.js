// End-to-end audit suites. They talk to a RUNNING local API (:3001) and the local staging WordPress (:8090);
// never point them at live systems. Run: npm run test:e2e  (from apps/api)
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/test/e2e/**/*.e2e.ts'],
  transform: { '^.+\.ts$': ['ts-jest', { tsconfig: { module: 'CommonJS', esModuleInterop: true, target: 'ES2022', types: ['jest', 'node'] }, diagnostics: false }] },
  testTimeout: 120000,
  maxWorkers: 1,
};
