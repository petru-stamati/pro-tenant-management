/** @type {import('jest').Config} */
module.exports = {
  rootDir: '..',
  testEnvironment: 'node',
  moduleFileExtensions: ['js', 'json', 'ts'],
  testRegex: 'test/.*\\.e2e-spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json', isolatedModules: true }],
  },
  setupFiles: ['<rootDir>/test/setup-env.ts'],
  // e2e tests hit a real Postgres + do full HTTP round trips — give them room.
  testTimeout: 30000,
  maxWorkers: 1,
};
