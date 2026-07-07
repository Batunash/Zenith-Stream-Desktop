import { _electron as electron } from 'playwright';
import { test, expect } from '@playwright/test';
import path from 'path';

test('App should launch and show Dashboard', async () => {
  // Launch Electron app
  const electronApp = await electron.launch({
    args: ['.'],
    env: { ...process.env, NODE_ENV: 'test' },
  });

  // Get the first window
  const window = await electronApp.firstWindow();

  // Wait for the window to load the URL
  await window.waitForLoadState('domcontentloaded');

  // Verify window title or content (Assuming we have Zenith Stream text or Add button)
  const title = await window.title();
  expect(title).toBe('Zenith Stream');

  // Close the app
  await electronApp.close();
});
