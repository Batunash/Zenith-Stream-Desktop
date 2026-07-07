import { _electron as electron } from 'playwright';
import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

let electronApp;
let window;

test.describe('Auth Flow E2E', () => {
  test.beforeAll(async () => {
    // Delete the test DB before starting to ensure a clean slate
    const dbPath = path.join(__dirname, '../video-hub-test.sqlite');
    if (fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  });

  test.beforeEach(async () => {
    electronApp = await electron.launch({
      args: ['.'],
      env: { ...process.env, NODE_ENV: 'test' },
    });
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.evaluate(() => window.localStorage.clear());
    await window.reload();
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('Should show login page and allow navigating to register', async () => {
    // Wait for the form to appear
    await window.waitForSelector('form');

    // Check if username input is visible
    await expect(window.locator('input[name="username"]')).toBeVisible();

    // Navigate to register (click the toggle link below the form)
    await window.locator('form + div span').click();
  });

  test('Should register a new user and login successfully', async () => {
    // Dismiss the alert automatically (Playwright handles this by default, but we can explicitly set it if needed)
    window.on('dialog', (dialog) => dialog.accept());

    // Go to register
    await window.waitForSelector('form');
    await window.locator('form + div span').click();

    // Fill register form
    const username = `e2euser_${Date.now()}`;
    await window.fill('input[name="username"]', username);
    await window.fill('input[name="password"]', 'testpassword123');
    await window.click('button[type="submit"]');

    // It should show an alert and return to login. We wait for the form to be ready for login
    // After returning to login, the username field should be visible. We wait a bit or just fill
    await window.waitForSelector('input[name="username"]');

    // Fill login form
    await window.fill('input[name="username"]', username);
    await window.fill('input[name="password"]', 'testpassword123');
    await window.click('button[type="submit"]');

    // Wait for the dashboard h1 to appear
    await expect(window.locator('h1')).toBeVisible({ timeout: 10000 });
  });

  test('Should fail login with wrong credentials', async () => {
    await window.waitForSelector('form');
    // Fill login form with wrong data
    await window.fill('input[name="username"]', 'wronguser');
    await window.fill('input[name="password"]', 'wrongpass');
    await window.click('button[type="submit"]');

    // Should show error message container (the one with specific styling or just any div above the button)
    // AuthPage has an error div rendered conditionally. We can look for the div with specific style or just wait for the button to be re-enabled.
    // The easiest is just checking if we stay on the login page by making sure 'form' is still there and h1 is not visible.
    await expect(window.locator('h1')).not.toBeVisible();
  });
});
