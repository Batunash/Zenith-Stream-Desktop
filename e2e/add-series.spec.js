import { _electron as electron } from 'playwright';
import { test, expect } from '@playwright/test';

let electronApp;
let window;

test.describe('Add Series E2E', () => {
  test.beforeEach(async () => {
    const { execSync } = require('child_process');
    execSync('node e2e/setup-db.js', { cwd: require('path').resolve(__dirname, '..') });

    electronApp = await electron.launch({
      args: ['.'],
      env: { ...process.env, NODE_ENV: 'test' },
    });
    window = await electronApp.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.evaluate(() => window.localStorage.clear());
    await window.reload();

    const path = require('path');
    const dummyPath = path.resolve(__dirname, 'dummy-media');

    await window.evaluate(async (dir) => {
      await window.api.invoke('settings:save', { MEDIA_DIR: dir, PORT: '3000' });
    }, dummyPath);

    // Perform login
    await window.waitForSelector('form');
    window.on('dialog', (dialog) => dialog.accept());

    await window.fill('input[name="username"]', 'playeruser');
    await window.fill('input[name="password"]', 'password123');
    await window.click('button[type="submit"]');

    await window.waitForSelector('h1');
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('Should navigate to Add Series and add manually', async () => {
    // Mock dialog in the main process
    await electronApp.evaluate(async ({ dialog }) => {
      dialog.showOpenDialog = () =>
        Promise.resolve({ filePaths: ['C:\\mock\\image.jpg'], canceled: false });
    });

    // Arama butonuna tıkla
    await window
      .locator('button', { hasText: /Dizi Ekle|Add/i })
      .first()
      .click();

    // Manual tabına tıkla
    await window
      .locator('button', { hasText: /Elle Gir|Manual/i })
      .first()
      .click();

    // Dialog handler'ı kaldır, playwright otomatik dismiss eder ama loglayalım
    window.on('dialog', (dialog) => {
      console.log('Dialog opened:', dialog.message());
    });

    const seriesName = `My Custom Series ${Date.now()}`;

    // Title inputunu bul
    const titleInputs = window.locator('input[type="text"]');
    await titleInputs.first().fill(seriesName);

    // Resim ekle butonuna bas
    await window.locator('button', { hasText: /Dosya/i }).first().click();

    // Resmin eklendiğini doğrula
    await expect(window.locator('text=image.jpg').first()).toBeVisible({ timeout: 5000 });

    // Kaydet butonuna bas
    await window
      .locator('button', { hasText: /Kaydet|Save/i })
      .first()
      .click();

    // Dashboard'a dönmesini ve dizinin görünmesini bekle
    try {
      await expect(window.locator('span', { hasText: seriesName }).first()).toBeVisible({
        timeout: 15000,
      });
    } catch (error) {
      console.log('--- DASHBOARD HTML DUMP ---');
      const html = await window.locator('body').innerHTML();
      console.log(html.substring(0, 5000));
      throw error;
    }
  });
});
