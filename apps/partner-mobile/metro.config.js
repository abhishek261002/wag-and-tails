const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch all files in the monorepo
config.watchFolders = [workspaceRoot];

// Resolve modules from both local and root node_modules
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Force Metro to resolve react-native from the partner-mobile workspace only
config.resolver.extraNodeModules = {
  'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
  react: path.resolve(projectRoot, 'node_modules/react'),
};

// Block Metro from traversing deprecated flow specs that crash the codegen parser
config.resolver.blockList = [
  /node_modules\/react-native\/src\/private\/specs_DEPRECATED\/.*/,
  /node_modules\/react-native\/src\/private\/components\/virtualview\/.*/,
];

module.exports = config;
