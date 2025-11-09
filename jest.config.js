export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'ES2022',
          moduleResolution: 'Node16',
        },
      },
    ],
  },
  testMatch: ['**/tests/**/*.test.ts'],
  collectCoverageFrom: ['server/src/**/*.ts'],
  coveragePathIgnorePatterns: ['/node_modules/', '/dist/'],
};
