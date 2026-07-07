const { VIDEO_EXTS } = require('./constants');

describe('Constants', () => {
  describe('VIDEO_EXTS', () => {
    it('should export an array', () => {
      expect(Array.isArray(VIDEO_EXTS)).toBe(true);
    });

    it('should contain supported video extensions', () => {
      expect(VIDEO_EXTS).toContain('.mp4');
      expect(VIDEO_EXTS).toContain('.mkv');
      expect(VIDEO_EXTS).toContain('.mov');
      expect(VIDEO_EXTS).toContain('.avi');
      expect(VIDEO_EXTS).toContain('.webm');
    });

    it('should have exactly 5 video extensions', () => {
      expect(VIDEO_EXTS.length).toBe(5);
    });

    it('should only contain string values', () => {
      VIDEO_EXTS.forEach((ext) => {
        expect(typeof ext).toBe('string');
      });
    });

    it('should all start with a dot', () => {
      VIDEO_EXTS.forEach((ext) => {
        expect(ext.startsWith('.')).toBe(true);
      });
    });

    it('should be case lowercase', () => {
      VIDEO_EXTS.forEach((ext) => {
        expect(ext).toBe(ext.toLowerCase());
      });
    });

    it('should have unique values', () => {
      const uniqueExts = [...new Set(VIDEO_EXTS)];
      expect(VIDEO_EXTS.length).toBe(uniqueExts.length);
    });

    it('should check if ext is in array', () => {
      expect(VIDEO_EXTS.includes('.mp4')).toBe(true);
      expect(VIDEO_EXTS.includes('.avi')).toBe(true);
      expect(VIDEO_EXTS.includes('.xyz')).toBe(false);
    });
  });
});
