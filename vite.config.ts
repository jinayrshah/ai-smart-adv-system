import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(({mode}) => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true' ? { overlay: false } : false,
      watch: {
        ignored: [
          '**/backend/**',
          '**/data/**',
          '**/fixtures/**',
          '**/.venv/**',
          '**/*.json',
          '**/users.json',
          '**/market_price_history.json',
          '**/disease_history.json',
        ],
      },
    },
    preview: {
      port: 3000,
      host: '0.0.0.0',
    },
    build: {
      sourcemap: mode === 'development',
      minify: mode === 'production',
    },
  };
});
