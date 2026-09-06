module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      function importMetaTransform() {
        return {
          visitor: {
            MetaProperty(path) {
              if (
                path.node.meta &&
                path.node.meta.name === 'import' &&
                path.node.property &&
                path.node.property.name === 'meta'
              ) {
                path.replaceWithSourceString('({ env: { MODE: "development" } })');
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