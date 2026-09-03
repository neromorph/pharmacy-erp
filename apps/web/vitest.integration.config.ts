import { defineConfig } from 'vitest/config'

// Integration tests hit the real remote Supabase. Run with:
//   bun run test:integration
// Needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and
// SUPABASE_SERVICE_ROLE_KEY (loaded from apps/web/.env.local when unset).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    setupFiles: ['tests/integration/env.ts'],
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false, // one file at a time: tests share the live DB
  },
})
