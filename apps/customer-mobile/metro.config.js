const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files in the monorepo so changes to packages/ are picked up
config.watchFolders = [workspaceRoot];

// 2. Resolve modules starting from the app's local node_modules, then workspace root.
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Packages that MUST be singletons — always resolved from the app's local copy.
//    This prevents the "duplicate React" crash (Cannot read properties of null).
const SINGLETON_MODULES = [
  'react',
  'react-native',
  'react-native-safe-area-context',
  'react-native-screens',
  'react-native-gesture-handler',
  'expo',
  'expo-router',
  'expo-status-bar',
];

const singletonMap = {};
for (const mod of SINGLETON_MODULES) {
  const localPath = path.resolve(projectRoot, 'node_modules', mod);
  try {
    require.resolve(localPath);
    singletonMap[mod] = localPath;
  } catch {
    // Not installed locally — fall through to default resolution
  }
}

config.resolver.extraNodeModules = new Proxy(singletonMap, {
  get: (target, name) =>
    typeof name === 'string' && name in target
      ? target[name]
      : path.resolve(workspaceRoot, 'node_modules', name),
});

// 4. Use resolveRequest to intercept imports of singleton packages from
//    any location (including inside @wag/* packages) and redirect them
//    to the app-local copy. This is the most reliable fix for the duplicate
//    React problem in Expo monorepos.
const existingResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (singletonMap[moduleName]) {
    return {
      filePath: require.resolve(singletonMap[moduleName]),
      type: 'sourceFile',
    };
  }
  // Also intercept sub-path imports like 'react/jsx-runtime'
  const topLevel = moduleName.split('/')[0];
  if (singletonMap[topLevel] && moduleName.startsWith(topLevel + '/')) {
    const subPath = moduleName.slice(topLevel.length);
    return {
      filePath: require.resolve(singletonMap[topLevel] + subPath),
      type: 'sourceFile',
    };
  }
  if (existingResolveRequest) {
    return existingResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// 5. Block Metro from traversing deprecated flow specs
config.resolver.blockList = [
  /node_modules\/react-native\/src\/private\/specs_DEPRECATED\/.*/,
  /node_modules\/react-native\/src\/private\/components\/virtualview\/.*/,
];

module.exports = config;
