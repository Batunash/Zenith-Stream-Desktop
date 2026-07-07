import { describe, it, expect, vi, beforeEach } from 'vitest';

// config.js reads fs at module-load time. The global require interceptor in
// vitest.setup.js returns global.__fsMock for `require('fs')`. Because the
// module is evaluated once and then cached in Node's require.cache, each test
// must delete that cache entry to force a fresh evaluation against the mocked
// fs state configured for that test.

describe('Config Module', () => {
  let fs;

  beforeEach(() => {
    vi.clearAllMocks();
    fs = global.__fsMock;
    fs.existsSync.mockReturnValue(false);
    fs.readFileSync.mockReturnValue('');
    delete require.cache[require.resolve('./config')];
  });

  const loadConfig = () => {
    delete require.cache[require.resolve('./config')];
    return require('./config');
  };

  describe('default configuration', () => {
    it('should export PORT', () => {
      const config = loadConfig();
      expect(config.PORT).toBeDefined();
      expect(typeof config.PORT).toBe('number');
    });

    it('should export JWT_SECRET', () => {
      const config = loadConfig();
      expect(config.JWT_SECRET).toBeDefined();
      expect(typeof config.JWT_SECRET).toBe('string');
    });

    it('should export JWT_EXPIRES_IN', () => {
      const config = loadConfig();
      expect(config.JWT_EXPIRES_IN).toBeDefined();
    });

    it('should export MEDIA_DIR', () => {
      const config = loadConfig();
      expect(config.MEDIA_DIR).toBeDefined();
      expect(typeof config.MEDIA_DIR).toBe('string');
    });
  });

  describe('default values', () => {
    it('should default PORT to 5000', () => {
      expect(loadConfig().PORT).toBe(5000);
    });

    it('should default JWT_SECRET to gizli_anahtar', () => {
      expect(loadConfig().JWT_SECRET).toBe('gizli_anahtar');
    });

    it('should default JWT_EXPIRES_IN to 7d', () => {
      expect(loadConfig().JWT_EXPIRES_IN).toBe('7d');
    });

    it('should default MEDIA_DIR under Desktop/Archive', () => {
      const config = loadConfig();
      expect(config.MEDIA_DIR).toContain('Archive');
      expect(config.MEDIA_DIR).toContain('Desktop');
    });
  });

  describe('user configuration overrides', () => {
    it('should read PORT from settings.json when present', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify({ PORT: 8080 }));
      expect(loadConfig().PORT).toBe(8080);
    });

    it('should read JWT_SECRET from settings.json when present', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify({ JWT_SECRET: 'custom-secret' }));
      expect(loadConfig().JWT_SECRET).toBe('custom-secret');
    });

    it('should read MEDIA_DIR from settings.json when present', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify({ MEDIA_DIR: '/custom/media' }));
      expect(loadConfig().MEDIA_DIR).toBe('/custom/media');
    });

    it('should fall back to defaults when settings file is missing', () => {
      fs.existsSync.mockReturnValue(false);
      const config = loadConfig();
      expect(config.PORT).toBe(5000);
      expect(config.JWT_EXPIRES_IN).toBe('7d');
    });

    it('should fall back to defaults when settings JSON is malformed', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('{ not valid json');
      const config = loadConfig();
      expect(config.PORT).toBe(5000);
      expect(config.JWT_EXPIRES_IN).toBe('7d');
    });

    it('should keep JWT_EXPIRES_IN as 7d even if user supplies one', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify({ JWT_EXPIRES_IN: '30d' }));
      expect(loadConfig().JWT_EXPIRES_IN).toBe('7d');
    });
  });

  describe('configuration sources', () => {
    it('should consult existsSync for the settings file', () => {
      loadConfig();
      expect(fs.existsSync).toHaveBeenCalled();
    });

    it('should only read the file when it exists', () => {
      fs.existsSync.mockReturnValue(false);
      loadConfig();
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });

    it('should read the file when it exists', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('{}');
      loadConfig();
      expect(fs.readFileSync).toHaveBeenCalled();
    });

    it('should locate settings.json in the Video Hub folder', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue('{}');
      loadConfig();
      const path = require('path');
      const os = require('os');
      const expectedBase =
        process.env.APPDATA ||
        (process.platform === 'darwin'
          ? os.homedir() + '/Library/Preferences'
          : os.homedir() + '/.config');
      const calledPath = fs.existsSync.mock.calls[0][0];
      expect(calledPath).toBe(path.join(expectedBase, 'Video Hub', 'settings.json'));
    });
  });

  describe('validation', () => {
    it('should have an integer PORT', () => {
      expect(Number.isInteger(loadConfig().PORT)).toBe(true);
    });

    it('should have valid JWT_EXPIRES_IN format', () => {
      expect(loadConfig().JWT_EXPIRES_IN).toMatch(/^\d+(s|m|h|d|w|y)$/);
    });

    it('should always expose four keys', () => {
      expect(Object.keys(loadConfig()).sort()).toEqual([
        'JWT_EXPIRES_IN',
        'JWT_SECRET',
        'MEDIA_DIR',
        'PORT',
      ]);
    });
  });
});
