const path = require('path');

module.exports = function (options) {
  return {
    ...options,
    // Inline all dependencies including @wag/* packages
    externals: [],
    resolve: {
      ...options.resolve,
      alias: {
        '@wag/config': path.resolve(__dirname, '../../packages/config/src/index.ts'),
        '@wag/shared-types': path.resolve(__dirname, '../../packages/shared-types/src/index.ts'),
        '@wag/validation': path.resolve(__dirname, '../../packages/validation/src/index.ts'),
      },
    },
    output: {
      ...options.output,
      // Ensure the output is a single main.js
      filename: 'main.js',
      path: path.resolve(__dirname, 'dist'),
    },
  };
};
