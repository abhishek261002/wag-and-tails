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
  'react-dom',
  'react-native',
  'react-native-web',
  'react-native-safe-area-context',
  'react-native-screens',
  'react-native-gesture-handler',
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

const VIRTUAL_VIEW_STUB = path.resolve(
  projectRoot,
  'metro-stubs/VirtualViewExperimentalNativeComponentStub.js'
);

const existingResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (singletonMap[moduleName]) {
    return { filePath: singletonMap[moduleName], type: 'sourceFile' };
  }

  const topLevel = moduleName.split('/')[0];
  if (singletonMap[topLevel] && moduleName.startsWith(topLevel + '/')) {
    try {
      const resolvedSub = require.resolve(moduleName, { paths: [projectRoot, workspaceRoot] });
      return { filePath: resolvedSub, type: 'sourceFile' };
    } catch {}
  }

  const result = existingResolveRequest
    ? existingResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);

  if (result && result.type === 'sourceFile' && result.filePath) {
    const resolved = result.filePath.replace(/\\/g, '/');
    const isLegacySpec =
      /\/react-native\/src\/private\/specs_DEPRECATED\//.test(resolved) ||
      /\/react-native\/src\/private\/components\/virtualview\//.test(resolved);
    if (isLegacySpec && /NativeComponent\.js$/.test(resolved)) {
      return { filePath: VIRTUAL_VIEW_STUB, type: 'sourceFile' };
    }
  }

  return result;
};

module.exports = config;
