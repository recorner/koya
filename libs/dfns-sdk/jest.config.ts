module.exports = {
  displayName: 'dfns-sdk',
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
  testTimeout: 30000,
  coverageDirectory: '../../coverage/libs/dfns-sdk',
  moduleNameMapper: {
    '^@koya/dfns-sdk$': '<rootDir>/src/index.ts',
  },
};
