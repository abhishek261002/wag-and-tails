module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      function importMetaTransform() {
        return {
          visitor: {
            MetaProperty(nodePath) {
              if (
                nodePath.node.meta &&
                nodePath.node.meta.name === 'import' &&
                nodePath.node.property &&
                nodePath.node.property.name === 'meta'
              ) {
                nodePath.replaceWithSourceString('({ env: { MODE: "development" } })');
              }
            },
          },
        };
      },
      [
        'module-resolver',
        {
          root: ['./'],
          extensions: ['.ios.js', '.android.js', '.js', '.ts', '.tsx', '.json'],
          alias: {
            '@wag/design-tokens': '../../packages/design-tokens/src/index.ts',
            '@wag/api-client': '../../packages/api-client/src/index.ts',
            '@wag/shared-types': '../../packages/shared-types/src/index.ts',
            '@wag/ui-mobile': '../../packages/ui-mobile/src/index.ts',
          },
        },
      ],
    ],
  };
};
