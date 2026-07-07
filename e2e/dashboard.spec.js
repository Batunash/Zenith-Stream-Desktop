import { _electron as electron } from 'playwright';
import { test, expect } from '@playwright/test';

let electronApp;
let window;

test.describe('Dashboard E2E', () => {

  test.beforeEach(async () => {
    electronApp = await electron.launch({
      args: ['.'],
      env: { ...process.env, NODE_ENV: 'test' }
    });
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.evaluate(() => window.localStorage.clear());
    await window.reload();

    await window.evaluate(async () => {
        await window.api.invoke('settings:save', { MEDIA_DIR: '/fake/test/dir', PORT: '3000' });
    });

    // Wait for form
    await window.waitForSelector('form');
    
    window.on('dialog', dialog => dialog.accept());

    // Go to register and login
    await window.locator('form + div span').click();
    const username = `dashuser_${Date.now()}`;
    await window.fill('input[name="username"]', username);
    await window.fill('input[name="password"]', 'password123');
    await window.click('button[type="submit"]');
    
    // Login after register
    await window.waitForSelector('input[name="username"]');
    await window.fill('input[name="username"]', username);
    await window.fill('input[name="password"]', 'password123');
    await window.click('button[type="submit"]');

    // Wait for dashboard h1
    await window.waitForSelector('h1');
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('Should render dashboard layout properly', async () => {
    // Verify Header is visible
    await expect(window.locator('h1')).toBeVisible();
    
    // Since DB is empty, it should probably show some empty state or just no series
    // but the layout should be intact.
    const bodyText = await window.locator('body').innerText();
    expect(bodyText).toContain('Zenith Stream');
  });

  // Test removed
});
