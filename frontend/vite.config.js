import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
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
