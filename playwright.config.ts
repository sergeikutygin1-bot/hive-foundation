import { defineConfig, devices } from '@playwright/test';

const PORT = 5179;

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 800 },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 800 },
        // Headless Chromium renders WebGL through SwiftShader; newer Chrome requires opting in.
        launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
      },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
