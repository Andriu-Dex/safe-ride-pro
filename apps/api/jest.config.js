module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
      },
    ],
  },
  clearMocks: true,
  collectCoverageFrom: [
    'src/modules/**/*.ts',
    '!src/**/*.module.ts',
    '!src/main.ts',
  ],
};
