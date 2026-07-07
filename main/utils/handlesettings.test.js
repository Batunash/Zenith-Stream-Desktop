import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSettings, saveSettings, moveArchiveContents } from './handlesettings';

describe('handlesettings', () => {
  let fs;

  beforeEach(() => {
    vi.clearAllMocks();
    fs = global.__fsMock;
  });

  describe('getSettings', () => {
    it('creates default config if file does not exist', () => {
      fs.existsSync.mockReturnValueOnce(false);

      const config = getSettings();

      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(config.PORT).toBe('5000');
      expect(config.MEDIA_DIR).toBeDefined();
    });

    it('returns parsed config if file exists', () => {
      fs.existsSync.mockReturnValueOnce(true);
      fs.readFileSync.mockReturnValueOnce(JSON.stringify({ PORT: '8080', MEDIA_DIR: 'C:\\Media' }));

      const config = getSettings();

      expect(config.PORT).toBe('8080');
    });

    it('returns default config if parsing fails', () => {
      fs.existsSync.mockReturnValueOnce(true);
      fs.readFileSync.mockImplementationOnce(() => {
        throw new Error('SyntaxError');
      });

      const config = getSettings();

      expect(config.PORT).toBe('5000');
    });
  });

  describe('saveSettings', () => {
    it('merges new settings and saves', () => {
      // getSettings() inside saveSettings reads existing config
      fs.existsSync.mockReturnValueOnce(true);
      fs.readFileSync.mockReturnValueOnce(JSON.stringify({ PORT: '5000', MEDIA_DIR: 'C:\\Media' }));

      saveSettings({ PORT: '9000' });

      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('"PORT": "9000"')
      );
    });
  });

  describe('moveArchiveContents', () => {
    let originalEnv;

    beforeEach(() => {
      originalEnv = process.env.NODE_ENV;
      delete process.env.NODE_ENV;
    });

    afterEach(() => {
      if (originalEnv !== undefined) process.env.NODE_ENV = originalEnv;
      else delete process.env.NODE_ENV;
    });

    it('returns early if NODE_ENV is test', () => {
      process.env.NODE_ENV = 'test';
      moveArchiveContents('C:\\old', 'C:\\new');
      expect(fs.existsSync).not.toHaveBeenCalled();
    });

    it('returns early if oldPath is missing or identical to newPath', () => {
      moveArchiveContents('C:\\same', 'C:\\same');
      expect(fs.existsSync).not.toHaveBeenCalled();
      moveArchiveContents(null, 'C:\\new');
      expect(fs.existsSync).not.toHaveBeenCalled();
    });

    it('returns early if oldPath does not exist', () => {
      fs.existsSync.mockReturnValueOnce(false);
      moveArchiveContents('C:\\old', 'C:\\new');
      expect(fs.readdirSync).not.toHaveBeenCalled();
    });

    it('moves directory contents properly', () => {
      // oldPath exists = true, newPath exists = false
      fs.existsSync.mockReturnValueOnce(true).mockReturnValueOnce(false);
      fs.readdirSync.mockReturnValueOnce(['file.txt', 'subdir']);
      fs.statSync.mockImplementation((p) => ({
        isDirectory: () => p.includes('subdir'),
      }));

      moveArchiveContents('C:\\old', 'C:\\new');

      expect(fs.mkdirSync).toHaveBeenCalledWith('C:\\new', { recursive: true });
      expect(fs.copyFileSync).toHaveBeenCalledWith(
        expect.stringContaining('file.txt'),
        expect.stringContaining('file.txt')
      );
      expect(fs.unlinkSync).toHaveBeenCalledWith(expect.stringContaining('file.txt'));
      expect(fs.cpSync).toHaveBeenCalledWith(
        expect.stringContaining('subdir'),
        expect.stringContaining('subdir'),
        { recursive: true }
      );
      expect(fs.rmSync).toHaveBeenCalledWith(expect.stringContaining('subdir'), {
        recursive: true,
        force: true,
      });
    });

    it('throws friendly error on failure', () => {
      fs.existsSync.mockReturnValueOnce(true).mockReturnValueOnce(true);
      fs.readdirSync.mockReturnValueOnce(['locked.mp4']);
      fs.statSync.mockReturnValueOnce({ isDirectory: () => false });
      fs.copyFileSync.mockImplementationOnce(() => {
        throw new Error('EBUSY');
      });

      expect(() => {
        moveArchiveContents('C:\\old', 'C:\\new');
      }).toThrow(
        'locked.mp4 kullanımda veya kilitli olduğu için taşınamadı. Lütfen açık videoları kapatın.'
      );
    });
  });
});
