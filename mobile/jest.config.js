module.exports = {
  preset: 'react-native',
  moduleNameMapper: {
    // Same alias as metro.config.js / tsconfig paths: the offline catalogues
    // live one level above the app folder.
    '^@shared/(.*)$': '<rootDir>/../shared/$1',
  },
  // react-native-svg ships untranspiled ESM; the RN preset only whitelists react-native itself.
  transformIgnorePatterns: ['node_modules/(?!(react-native|@react-native|react-native-svg)/)'],
  collectCoverageFrom: ['src/domain/**/*.ts'],
  coverageThreshold: {
    global: {lines: 80, statements: 80, functions: 80, branches: 70},
  },
};
