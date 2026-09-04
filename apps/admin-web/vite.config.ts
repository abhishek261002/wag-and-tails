import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@wag/design-tokens': path.resolve(__dirname, '../../packages/design-tokens/src/index.ts'),
      '@wag/api-client': path.resolve(__dirname, '../../packages/api-client/src/index.ts'),
      '@wag/shared-types': path.resolve(__dirname, '../../packages/shared-types/src/index.ts'),
      '@wag/ui-web': path.resolve(__dirname, '../../packages/ui-web/src/index.ts'),
    },
  },
  server: {
    port: 3004,
    proxy: { '/api': 'http://localhost:3001' },
  },
});
