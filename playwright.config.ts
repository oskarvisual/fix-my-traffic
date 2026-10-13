import { defineConfig, devices } from '@playwright/test';
export default defineConfig({ testDir: './e2e', use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5173' }, webServer: { command: './node_modules/.bin/vite --host 127.0.0.1', url: 'http://127.0.0.1:5173', reuseExistingServer: true } });
