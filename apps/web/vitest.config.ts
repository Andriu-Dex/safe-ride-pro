import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx'],
    css: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: [
        'src/modules/**/lib/*.ts',
        'src/app/(app)/confianza/utils/*.ts'
      ],
      exclude: [
        'src/modules/auth/lib/auth-api.ts',
        '**/*.spec.ts'
      ],
    },
  },
});
