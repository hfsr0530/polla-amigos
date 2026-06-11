import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // La primera consulta de cada archivo arranca PGlite (Postgres en WASM);
    // con varios archivos en paralelo ese arranque puede pasar de 5 s
    testTimeout: 20000,
  },
  resolve: {
    alias: {
      // los services importan 'server-only' (guard de RSC); en tests se anula
      'server-only': path.resolve(__dirname, 'src/test/server-only-stub.ts'),
      '@': path.resolve(__dirname, 'src'),
    },
  },
})
