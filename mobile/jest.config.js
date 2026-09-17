module.exports = {
  preset: 'react-native',
  moduleNameMapper: {
    // Same alias as metro.config.js / tsconfig paths: the offline catalogues
    // live one level above the app folder.
    '^@shared/(.*)$': '<rootDir>/../shared/$1',
  },
  // react-native-svg ships untranspiled ESM; the RN preset only whitelists react-native itself.
  transformIgnorePatterns: ['node_modules/(?!(react-native|@react-native|react-native-svg)/)'],
  // Pure logic plus the presentational pieces that have render tests. Screens
  // and repositories need the native database and are exercised on the
  // emulator instead (see README "Kiểm thử").
  collectCoverageFrom: [
    'src/domain/**/*.ts',
    'src/components/{Badge,Checkbox,DashboardCard,NumberText,OfflineBanner,ScreenErrorBoundary,SoftGradient,Tabs}.tsx',
    'src/components/charts/*.{ts,tsx}',
    'src/utils/{format,growthStage}.ts',
  ],
  coverageThreshold: {
    global: {lines: 85, statements: 85, functions: 80, branches: 70},
  },
};
