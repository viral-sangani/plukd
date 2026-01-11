import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    include: [
      'app/**/*.test.{ts,tsx}',
      'app/**/*.spec.{ts,tsx}',
      'components/**/*.test.{ts,tsx}',
      'components/**/*.spec.{ts,tsx}',
      'lib/**/*.test.{ts,tsx}',
      'lib/**/*.spec.{ts,tsx}',
    ],
    exclude: ['tests', 'node_modules', '.next'],
    setupFiles: ['tests/setup.ts'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}'],
      exclude: [
        'tests/**',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        'node_modules',
        '.next',
      ],
      thresholds: {
        statements: 75,
        branches: 70,
        functions: 80,
        lines: 75,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
