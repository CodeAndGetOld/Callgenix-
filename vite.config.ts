import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['@twilio/voice-sdk', '@heroicons/react/24/outline'],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'twilio-voice': ['@twilio/voice-sdk'],
          'heroicons': ['@heroicons/react/24/outline'],
        },
      },
    },
    sourcemap: true,
    target: 'esnext',
  },
});