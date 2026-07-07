import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockInit, mockUse, mockI18n } = vi.hoisted(() => {
  const mockInit = vi.fn();
  const mockI18n = {};
  const mockUse = vi.fn(() => mockI18n);
  Object.assign(mockI18n, { use: mockUse, init: mockInit });
  return { mockInit, mockUse, mockI18n };
});

// Mock i18next so the .use(...).use(...).init(...) chain flows through our
// shared spies. `default` is the i18n instance imported as `import i18n from 'i18next'`.
// react-i18next (initReactI18next) is already mocked globally in vitest.setup.js.
vi.mock('i18next', () => ({
  __esModule: true,
  default: mockI18n,
  init: mockInit,
  use: mockUse,
  initReactI18next: { type: '3rdParty', instance: 'i18n' },
}));

vi.mock('i18next-browser-languagedetector', () => ({
  __esModule: true,
  default: { type: 'languageDetector' },
}));

describe('i18n Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  // i18n.js uses ESM `import` syntax but the package.json is "type": "commonjs",
  // so `require('./i18n')` throws a SyntaxError. Dynamic `import()` runs through
  // vitest's transformer (which converts the ESM and applies vi.mock), so each
  // test re-evaluates the module body fresh after vi.resetModules().
  it('imports i18next and calls use on it', async () => {
    await import('./i18n');
    expect(mockUse).toHaveBeenCalled();
  });

  it('uses LanguageDetector and initReactI18next (two .use calls)', async () => {
    await import('./i18n');
    expect(mockUse).toHaveBeenCalledTimes(2);
  });

  it('initializes with the correct config', async () => {
    await import('./i18n');
    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({
        fallbackLng: 'en',
        interpolation: expect.objectContaining({ escapeValue: false }),
      })
    );
  });

  it('registers resources for all languages', async () => {
    await import('./i18n');
    expect(mockInit).toHaveBeenCalledWith(
      expect.objectContaining({
        resources: expect.objectContaining({
          tr: expect.any(Object),
          en: expect.any(Object),
          es: expect.any(Object),
          de: expect.any(Object),
          fr: expect.any(Object),
          ru: expect.any(Object),
        }),
      })
    );
  });

  it('sets the fallback language to English', async () => {
    await import('./i18n');
    const args = mockInit.mock.calls[0][0];
    expect(args.fallbackLng).toBe('en');
  });

  it('disables HTML escaping in interpolation', async () => {
    await import('./i18n');
    const args = mockInit.mock.calls[0][0];
    expect(args.interpolation.escapeValue).toBe(false);
  });

  it('chains use -> use -> init on the same i18n instance', async () => {
    await import('./i18n');
    // Each .use() returns mockI18n (the same instance), then .init is called on it.
    expect(mockUse).toHaveReturnedTimes(2);
    expect(mockUse.mock.results[0].value).toBe(mockI18n);
    expect(mockUse.mock.results[1].value).toBe(mockI18n);
    expect(mockInit).toHaveBeenCalled();
  });

  it('registers exactly one translation resource per language', async () => {
    await import('./i18n');
    const args = mockInit.mock.calls[0][0];
    expect(Object.keys(args.resources).sort()).toEqual(['de', 'en', 'es', 'fr', 'ru', 'tr']);
    expect(args.resources.tr.translation).toBeDefined();
    expect(args.resources.en.translation).toBeDefined();
  });
});
