const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch monorepo root
config.watchFolders = [workspaceRoot];

// 2. Resolve module search paths
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Keep critical singletons matched across packages
const SINGLETON_MODULES = [
  'react',
  'react-dom',
  'react-native',
  'react-native-web',
  'react-native-safe-area-context',
  'react-native-screens',
  'react-native-gesture-handler',
  'expo',
  'expo-router',
  'expo-status-bar',
];

const singletonMap = {};
for (const mod of SINGLETON_MODULES) {
  try {
    singletonMap[mod] = require.resolve(mod, { paths: [projectRoot, workspaceRoot] });
  } catch {}
}

config.resolver.extraNodeModules = new Proxy(singletonMap, {
  get: (target, name) =>
    typeof name === 'string' && name in target
      ? target[name]
      : path.resolve(workspaceRoot, 'node_modules', name),
});

// 4. Resolve requests
const existingResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  // Direct singleton matches
  if (singletonMap[moduleName]) {
    return {
      filePath: singletonMap[moduleName],
      type: 'sourceFile',
    };
  }

  // Singleton subpaths like 'react/jsx-runtime' or 'react-dom/client'
  const topLevel = moduleName.split('/')[0];
  if (singletonMap[topLevel] && moduleName.startsWith(topLevel + '/')) {
    try {
      const resolvedSub = require.resolve(moduleName, { paths: [projectRoot, workspaceRoot] });
      return {
        filePath: resolvedSub,
        type: 'sourceFile',
      };
    } catch {}
  }

  if (existingResolveRequest) {
    return existingResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

// 5. Block deprecated flow specs
config.resolver.blockList = [
  /node_modules\/react-native\/src\/private\/specs_DEPRECATED\/.*/,
  /node_modules\/react-native\/src\/private\/components\/virtualview\/.*/,
];

module.exports = config;