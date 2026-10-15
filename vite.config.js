import { defineConfig } from 'vite';

// Versionsnumret sätts av GitHub Actions (APP_VERSION) och visas i appen.
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(process.env.APP_VERSION || '1.0.0-dev'),
  },
});
