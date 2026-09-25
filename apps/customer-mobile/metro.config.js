const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch only what this app actually needs: itself and the shared
// workspace packages. Watching the whole monorepo root (every sibling app,
// including apps/api) is unnecessary and fragile — Metro's non-Watchman
// fallback watcher on Windows crawls every directory it finds and then
// fs.watch()'s each one, and a directory that existed at crawl time but is
// gone by watch-setup time (e.g. apps/api/dist, recreated/removed by the
// API's own build) throws an uncaught ENOENT that kills the whole Metro
// process outright.
config.watchFolders = [projectRoot, path.resolve(workspaceRoot, 'packages')];

// 2. Resolve module search paths
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Keep critical singletons matched across packages.
// Only native-module-backed packages belong here — the kind that break
// with "Invalid hook call"/duplicate-context bugs if the app and a shared
// workspace package (like @wag/ui-mobile) end up with two physical copies.
// `expo`, `expo-router` and `expo-status-bar` must NOT be forced through
// this path: `expo-router/entry` is also the file Expo's dev server uses
// to compute the public bundle URL it serves to the browser, and routing
// it through a raw require.resolve() here returns an OS-native (backslash,
// on Windows) path that leaks into that URL instead of Metro's normal
// resolver producing a proper "/node_modules/expo-router/entry.bundle"
// path — the browser then 404/500s trying to fetch a backslash-y URL.
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

// 4. Resolve requests
const VIRTUAL_VIEW_STUB = path.resolve(
  projectRoot,
  'metro-stubs/VirtualViewExperimentalNativeComponentStub.js'
);
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

  // Several of react-native 0.86.3's own legacy/experimental codegen spec
  // files (under src/private/specs_DEPRECATED and the virtualview
  // components) use Flow prop/event types this Metro/codegen combo can't
  // parse — a real upstream bug confirmed across several distinct,
  // unrelated files (VirtualView*NativeComponent, AndroidSwitchNative
  // Component, AndroidSwipeRefreshLayoutNativeComponent), not a version
  // mismatch. These are pulled in unconditionally by ordinary cross-
  // platform RN components (Switch, RefreshControl, ...) picking between
  // their Android/iOS native components even when only one platform is
  // being built, so swap any of them for a harmless stub by destination
  // path rather than chase each broken file's every possible importer.
  if (result && result.type === 'sourceFile' && result.filePath) {
    const resolved = result.filePath.replace(/\\/g, '/');
    const isLegacyOrExperimentalSpec =
      /\/react-native\/src\/private\/specs_DEPRECATED\//.test(resolved) ||
      /\/react-native\/src\/private\/components\/virtualview\//.test(resolved);
    if (isLegacyOrExperimentalSpec && /NativeComponent\.js$/.test(resolved)) {
      return { filePath: VIRTUAL_VIEW_STUB, type: 'sourceFile' };
    }
  }

  return result;
};

module.exports = config;