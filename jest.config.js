module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.ts', '**/src/**/*.test.ts'],
  // TestWorkflowEnvironment.createLocal() spins up an embedded Temporal dev
  // server in beforeAll — routinely exceeds Jest's 5s default hook timeout,
  // especially under parallel worker contention.
  testTimeout: 30000,
};
