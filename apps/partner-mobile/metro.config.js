const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch only this app and the shared workspace packages, not the whole
// monorepo root — see customer-mobile/metro.config.js for why (Metro's
// Windows fallback watcher crashes the whole process with an uncaught
// ENOENT if a sibling app's build artifact directory, e.g. apps/api/dist,
// disappears between its initial crawl and fs.watch() setup).
config.watchFolders = [projectRoot, path.resolve(workspaceRoot, 'packages')];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

const SINGLETON_MODULES = [
  'react',
  'react-dom',
  'react-native',
  'react-native-web',
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

  // Workspace packages are TypeScript written for NodeNext, so they import './x.js' meaning './x.ts'.
  // Metro does not map that, so retry a failed relative '.js' import without the extension.
  const resolveDefault = (name) =>
    existingResolveRequest
      ? existingResolveRequest(context, name, platform)
      : context.resolveRequest(context, name, platform);
  let result;
  try {
    result = resolveDefault(moduleName);
  } catch (err) {
    if (/^\.{1,2}\/.*\.js$/.test(moduleName)) result = resolveDefault(moduleName.slice(0, -3));
    else throw err;
  }

  // NOTE: do not replace any of react-native's own *NativeComponent.js files (Modal, Switch, RefreshControl...)
  // with a stub: bundling passes, but the shipped Android build then has no native Modal or Switch (sheets never
  // appear, the online toggle does nothing) while web looks fine.

  return result;
};

module.exports = config;
