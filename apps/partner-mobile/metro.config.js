const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

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
    // not locally installed
  }
}

config.resolver.extraNodeModules = new Proxy(singletonMap, {
  get: (target, name) =>
    typeof name === 'string' && name in target
      ? target[name]
      : path.resolve(workspaceRoot, 'node_modules', name),
});

const existingResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (singletonMap[moduleName]) {
    return {
      filePath: require.resolve(singletonMap[moduleName]),
      type: 'sourceFile',
    };
  }
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

config.resolver.blockList = [
  /node_modules\/react-native\/src\/private\/specs_DEPRECATED\/.*/,
  /node_modules\/react-native\/src\/private\/components\/virtualview\/.*/,
];

module.exports = config;
