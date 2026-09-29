import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Minimal config for the mock integration check. Sets VITE_USE_MOCKS so the
// same code path the browser uses is what gets bundled here.
export default defineConfig({
  root: process.env.MOCKCHECK_ROOT,
  plugins: [react()],
  esbuild: { jsx: 'automatic' },
  // Node runs the output directly, so the browser target that Vite defaults to
  // is wrong here — and it rejects the top-level awaits this script uses to
  // sequence its checks.
  build: { target: 'node18' },
  ssr: { target: 'node' },
  define: { 'import.meta.env.VITE_USE_MOCKS': '"true"' },
});
