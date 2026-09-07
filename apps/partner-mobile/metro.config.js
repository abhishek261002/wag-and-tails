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

// `expo`, `expo-router` and `expo-status-bar` must NOT be forced through
// this path: `expo-router/entry` is also the file Expo's dev server uses
// to compute the public bundle URL it serves to the browser, and routing
// it through a raw require.resolve() here returns an OS-native (backslash,
// on Windows) path that leaks into that URL instead of Metro's normal
// resolver producing a proper "/node_modules/expo-router/entry.bundle"
// path — the browser then 404/500s trying to fetch a backslash-y URL.
const SINGLETON_MODULES = [
  'react',
  'react-native',
  'react-native-safe-area-context',
  'react-native-screens',
  'react-native-gesture-handler',
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

module.exports = config;
