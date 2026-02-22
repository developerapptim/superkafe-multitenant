module.exports = {
  testEnvironment: 'node',
  coveragePathIgnorePatterns: ['/node_modules/'],
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'utils/**/*.js',
    'controllers/**/*.js',
    'services/**/*.js',
    '!**/node_modules/**'
  ]
};
