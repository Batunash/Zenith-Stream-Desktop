import { _electron as electron } from 'playwright';
import { test, expect } from '@playwright/test';

let electronApp;
let window;

test.describe('Settings E2E', () => {

  test.beforeEach(async () => {
    const { execSync } = require('child_process');
    execSync('node e2e/setup-db.js', { cwd: require('path').resolve(__dirname, '..') });

    electronApp = await electron.launch({
      args: ['.'],
      env: { ...process.env, NODE_ENV: 'test' }
    });
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.evaluate(() => window.localStorage.clear());
    await window.reload();

    // Perform login
    await window.waitForSelector('form');
    window.on('dialog', dialog => dialog.accept());
    
    await window.fill('input[name="username"]', 'playeruser');
    await window.fill('input[name="password"]', 'password123');
    await window.click('button[type="submit"]');

    await window.waitForSelector('h1');
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('Should navigate to Settings, update values and save', async () => {
    // Ayarlar butonuna tıkla
    await window.locator('button[title*="Ayarlar"], button[title*="Settings"], button:has-text("Ayarlar")').first().click();

    // Port inputunu bul (value 3000 olabilir)
    const portInput = window.locator('div', { hasText: /Port/i }).locator('input').first();
    await expect(portInput).toBeVisible({ timeout: 10000 });
    await portInput.fill('4000');
    
    // Kaydet butonuna tıkla
    await window.locator('button', { hasText: /Kaydet|Save/i }).first().click();

    // Alert dialog çıkacak, on'dialog' ile otomatik onaylanacak (beforeEach içinde eklendi).
  });
});
