module.exports = {
  displayName: 'bria-adapter',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]sx?$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        useESM: false,
      },
    ],
  },
  extensionsToTreatAsEsm: [],
  transformIgnorePatterns: ['node_modules/.pnpm/(?!(uuid)@)'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  testPathIgnorePatterns: ['/node_modules/', '/test/e2e/'],
  testTimeout: 30000,
  coverageDirectory: '../../coverage/libs/bria-adapter',
  moduleNameMapper: {
    '^@koya/types$': '<rootDir>/../../libs/types/src/index.ts',
    '^@koya/config$': '<rootDir>/../../libs/config/src/index.ts',
    '^@koya/bria-adapter$': '<rootDir>/src/index.ts',
  },
};
