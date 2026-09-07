/**
 * Open Sans is bundled with the app — the farmer app must render correctly with
 * no network at all, so fonts are never fetched at runtime (design rule 3.3).
 *
 * After changing the font files run:  npx react-native-asset
 */
module.exports = {
  project: {
    android: {},
    ios: {},
  },
  assets: ['./src/assets/fonts/'],
};
