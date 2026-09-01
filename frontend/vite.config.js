import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  resolve: {
    /* This repo is an npm workspace, so packages get hoisted to the root
       node_modules — lucide-react among them, and it is imported by 41 files.
       The root also carries an undeclared react 19.2.4, so anything resolving
       from up there got a different React than the app's own 18.3.1, and two
       dispatchers in one page means every hook reads null:

         Uncaught TypeError: Cannot read properties of null (reading 'useRef')
           at useSyncExternalStoreWithSelector (zustand)
           at ThemeProvider (main.jsx)

       Deduping pins every react import to one copy no matter where the
       importer sits in the tree. */
    dedupe: ['react', 'react-dom'],
  },
  build: {
    // This app's page stylesheets define shared, unscoped primitives
    // (.dashboard-grid, .stat-card, .setting-row, .account-page …) that other
    // pages rely on without importing them. Per-route CSS chunks break that:
    // a page would only load its own stylesheet and lose those rules. One CSS
    // bundle preserves the original global cascade. JS stays split.
    cssCodeSplit: false,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      }
    }
  }
});
