import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let originalCwd;

beforeEach(() => {
  vi.clearAllMocks();
  originalCwd = process.cwd;
  // ENV_PATH is computed at module load as path.join(process.cwd(), '.env').
  process.cwd = vi.fn(() => '/test');
  global.__fsMock.existsSync.mockReturnValue(false);
  global.__fsMock.readFileSync.mockReturnValue('');
  delete require.cache[require.resolve('./processenv')];
});

afterEach(() => {
  process.cwd = originalCwd;
});

describe('processenv Module', () => {
  describe('parseEnv()', () => {
    it('returns an empty object when .env does not exist', () => {
      global.__fsMock.existsSync.mockReturnValue(false);
      const { parseEnv } = require('./processenv');
      expect(parseEnv()).toEqual({});
    });

    it('parses a valid .env file', () => {
      global.__fsMock.existsSync.mockReturnValue(true);
      global.__fsMock.readFileSync.mockReturnValue('PORT=3000\nJWT_SECRET=secret\n');
      const { parseEnv } = require('./processenv');
      expect(parseEnv()).toEqual({ PORT: '3000', JWT_SECRET: 'secret' });
    });

    it('returns an empty object for an empty .env file', () => {
      global.__fsMock.existsSync.mockReturnValue(true);
      global.__fsMock.readFileSync.mockReturnValue('');
      const { parseEnv } = require('./processenv');
      expect(parseEnv()).toEqual({});
    });

    it('skips lines without an = sign', () => {
      global.__fsMock.existsSync.mockReturnValue(true);
      global.__fsMock.readFileSync.mockReturnValue('INVALID_LINE\nKEY=VALUE\n');
      const { parseEnv } = require('./processenv');
      expect(parseEnv()).toEqual({ KEY: 'VALUE' });
    });

    it('trims keys and values', () => {
      global.__fsMock.existsSync.mockReturnValue(true);
      global.__fsMock.readFileSync.mockReturnValue('  KEY  =  VALUE  \n');
      const { parseEnv } = require('./processenv');
      expect(parseEnv()).toEqual({ KEY: 'VALUE' });
    });

    it('drops keys whose value is empty (KEYONLY= is skipped)', () => {
      // Source: `if (key && value)` — an empty value is falsy and not stored.
      global.__fsMock.existsSync.mockReturnValue(true);
      global.__fsMock.readFileSync.mockReturnValue('KEYONLY=\n');
      const { parseEnv } = require('./processenv');
      expect(parseEnv()).toEqual({});
    });

    it('skips comment lines starting with #', () => {
      global.__fsMock.existsSync.mockReturnValue(true);
      global.__fsMock.readFileSync.mockReturnValue('# This is a comment\nKEY=VALUE\n');
      const { parseEnv } = require('./processenv');
      expect(parseEnv()).toEqual({ KEY: 'VALUE' });
    });

    it('only keeps the segment before the second = when a value contains =', () => {
      // Source uses line.split('=') which splits on EVERY '=' (not the first).
      global.__fsMock.existsSync.mockReturnValue(true);
      global.__fsMock.readFileSync.mockReturnValue('URL=https://example.com?foo=bar\n');
      const { parseEnv } = require('./processenv');
      expect(parseEnv().URL).toBe('https://example.com?foo');
    });
  });

  describe('saveEnv()', () => {
    it('writes a new config to the .env file', () => {
      global.__fsMock.existsSync.mockReturnValue(false);
      const { saveEnv } = require('./processenv');
      saveEnv({ PORT: '3000' });
      expect(global.__fsMock.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('.env'),
        expect.stringContaining('PORT=3000')
      );
    });

    it('merges with the existing config', () => {
      global.__fsMock.existsSync.mockReturnValue(true);
      global.__fsMock.readFileSync.mockReturnValue('PORT=3000\nEXISTING=value\n');
      const { saveEnv } = require('./processenv');
      saveEnv({ PORT: '3001' });
      const saved = global.__fsMock.writeFileSync.mock.calls[0][1];
      expect(saved).toContain('PORT=3001');
      expect(saved).toContain('EXISTING=value');
    });

    it('overwrites existing keys', () => {
      global.__fsMock.existsSync.mockReturnValue(true);
      global.__fsMock.readFileSync.mockReturnValue('PORT=3000\n');
      const { saveEnv } = require('./processenv');
      saveEnv({ PORT: '3001' });
      const saved = global.__fsMock.writeFileSync.mock.calls[0][1];
      expect(saved).toContain('PORT=3001');
      expect(saved).not.toContain('PORT=3000');
    });

    it('handles an empty config (writes an empty string)', () => {
      global.__fsMock.existsSync.mockReturnValue(false);
      const { saveEnv } = require('./processenv');
      saveEnv({});
      expect(global.__fsMock.writeFileSync).toHaveBeenCalled();
      expect(global.__fsMock.writeFileSync.mock.calls[0][1]).toBe('');
    });

    it('writes content in KEY=VALUE format', () => {
      global.__fsMock.existsSync.mockReturnValue(false);
      const { saveEnv } = require('./processenv');
      saveEnv({ KEY1: 'VALUE1', KEY2: 'VALUE2' });
      const content = global.__fsMock.writeFileSync.mock.calls[0][1];
      expect(content).toMatch(/KEY1=VALUE1/);
      expect(content).toMatch(/KEY2=VALUE2/);
    });

    it('preserves special characters in values', () => {
      global.__fsMock.existsSync.mockReturnValue(false);
      const { saveEnv } = require('./processenv');
      saveEnv({ SECRET: 'abc@123!@#' });
      const content = global.__fsMock.writeFileSync.mock.calls[0][1];
      expect(content).toContain('SECRET=abc@123!@#');
    });
  });
});
