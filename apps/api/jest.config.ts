export default {
  displayName: 'api',
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
  transformIgnorePatterns: [
    'node_modules/.pnpm/(?!(uuid)@)',
  ],
  moduleFileExtensions: ['ts', 'js', 'json'],
  testTimeout: 30000,
  coverageDirectory: '../../coverage/apps/api',
  moduleNameMapper: {
    '^@koya/types$': '<rootDir>/../../libs/types/src/index.ts',
    '^@koya/config$': '<rootDir>/../../libs/config/src/index.ts',
  },
};
