const path = require('path');
const {getDefaultConfig, mergeConfig} = require('@react-native/metro-config');

const repoRoot = path.resolve(__dirname, '..');
const sharedDir = path.resolve(repoRoot, 'shared');

const ALIAS = '@shared/';

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * `shared/` lives outside the app folder, so Metro has to be told to watch it.
 * That lets the app import the offline catalogues (`shared/data/*.json`) straight
 * from the single source of truth instead of keeping a duplicated copy in sync.
 *
 * The alias is resolved by hand rather than through `extraNodeModules`: a name
 * beginning with `@` looks like an npm scope to Metro, so it would try to match
 * the key `@shared/data` and never find `@shared`.
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  watchFolders: [sharedDir],
  resolver: {
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName.startsWith(ALIAS)) {
        return context.resolveRequest(
          context,
          path.join(sharedDir, moduleName.slice(ALIAS.length)),
          platform,
        );
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
