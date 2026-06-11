module.exports = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  testPathIgnorePatterns: ['<rootDir>/test/db/'],
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
    'src/modules/**/application/**/*.ts',
    'src/modules/**/presentation/controllers/**/*.ts',
    '!src/**/*.module.ts',
    '!src/main.ts',
  ],
};
