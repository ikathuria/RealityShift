import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Deliberately does NOT load vite-plugin-cesium: the Cesium plugin injects a
// global and copies assets, which is irrelevant (and heavy) for unit tests.
// Tests target pure logic and light components, not the WebGL globe.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**', 'src/data/**', 'src/components/ErrorBoundary.tsx'],
    },
  },
})
