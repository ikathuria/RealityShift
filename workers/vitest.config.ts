import { defineConfig } from 'vitest/config'

// Node environment — the Worker's pure helpers are plain TS with no runtime deps.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
  },
})
