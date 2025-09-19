import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    include: ['tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'vitest.config.js',
        '**/*.test.js'
      ]
    },
    // Allow testing of browser-specific APIs
    testTimeout: 10000,
    hookTimeout: 10000
  },
  // Define globals for browser APIs that Beatrove uses
  define: {
    global: 'globalThis',
  },
  // Resolve modules for testing
  resolve: {
    alias: {
      '@': './assets'
    }
  }
})