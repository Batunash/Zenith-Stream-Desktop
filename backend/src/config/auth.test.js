import { describe, it, expect, vi, beforeEach } from 'vitest';
const jwt = require('jsonwebtoken');

// Share a single mock config object between the test file, vi.mock, and the
// require.cache injection used for CJS interop (see existing mediaController.test.js).
const cfg = vi.hoisted(() => ({
  JWT_SECRET: 'test-secret-key',
  JWT_EXPIRES_IN: '7d',
  PORT: 5000,
  MEDIA_DIR: '/tmp/media'
}));

vi.mock('./config', () => ({ ...cfg }));

const _path = require('path');
const _cfgResolved = _path.resolve(process.cwd(), 'backend/src/config/config.js');
require.cache[_cfgResolved] = {
  id: _cfgResolved, filename: _cfgResolved, loaded: true,
  exports: cfg, children: [], paths: []
};

describe('Auth Module', () => {
  let auth;

  beforeEach(() => {
    vi.clearAllMocks();
    delete require.cache[require.resolve('./auth')];
    auth = require('./auth');
  });

  describe('exports', () => {
    it('should export JWT_SECRET from config', () => {
      expect(auth.JWT_SECRET).toBe('test-secret-key');
    });

    it('should export JWT_EXPIRES_IN from config', () => {
      expect(auth.JWT_EXPIRES_IN).toBe('7d');
    });

    it('should export generateToken function', () => {
      expect(typeof auth.generateToken).toBe('function');
    });

    it('should export verifyToken function', () => {
      expect(typeof auth.verifyToken).toBe('function');
    });
  });

  describe('generateToken()', () => {
    it('should generate a valid JWT token', () => {
      const token = auth.generateToken(123);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3);
    });

    it('should include userId in token payload', () => {
      const token = auth.generateToken(456);
      const decoded = jwt.decode(token);
      expect(decoded.userId).toBe(456);
    });

    it('should set expiration from config', () => {
      const token = auth.generateToken(123);
      const decoded = jwt.decode(token);
      expect(decoded.exp).toBeDefined();
      expect(typeof decoded.exp).toBe('number');
    });

    it('should handle different userId types', () => {
      expect(auth.generateToken('user123')).toBeDefined();
      expect(auth.generateToken(789)).toBeDefined();
      expect(auth.generateToken({ id: 'object-id' })).toBeDefined();
    });

    it('should produce different tokens for different userIds', () => {
      const t1 = auth.generateToken(1);
      const t2 = auth.generateToken(2);
      expect(t1).not.toBe(t2);
    });
  });

  describe('verifyToken()', () => {
    it('should verify a valid token and return payload', () => {
      const token = auth.generateToken(123);
      const decoded = auth.verifyToken(token);
      expect(decoded.userId).toBe(123);
    });

    it('should throw on an invalid token', () => {
      expect(() => auth.verifyToken('not.a.valid.token')).toThrow();
    });

    it('should throw on a completely malformed token', () => {
      expect(() => auth.verifyToken('garbage')).toThrow();
    });

    it('should throw on a token signed with the wrong secret', () => {
      const wrongSecretToken = jwt.sign({ userId: 123 }, 'a-different-secret');
      expect(() => auth.verifyToken(wrongSecretToken)).toThrow();
    });

    it('should throw on an expired token', () => {
      const past = Math.floor(Date.now() / 1000) - 3600;
      const expired = jwt.sign({ userId: 123, exp: past }, 'test-secret-key');
      expect(() => auth.verifyToken(expired)).toThrow();
    });

    it('should return decoded payload on success', () => {
      const token = auth.generateToken(456);
      const decoded = auth.verifyToken(token);
      expect(decoded).toHaveProperty('userId', 456);
    });

    it('should handle token with string userId', () => {
      const token = jwt.sign({ userId: 'abc-123' }, 'test-secret-key');
      expect(auth.verifyToken(token).userId).toBe('abc-123');
    });

    it('should throw on null/undefined token', () => {
      expect(() => auth.verifyToken(null)).toThrow();
      expect(() => auth.verifyToken(undefined)).toThrow();
    });
  });

  describe('generate/verify integration', () => {
    it('should round-trip a token successfully', () => {
      const userId = 999;
      const token = auth.generateToken(userId);
      const verified = auth.verifyToken(token);
      expect(verified.userId).toBe(userId);
    });

    it('should reject a token forged by an attacker with a different secret', () => {
      const forged = jwt.sign({ userId: 1 }, 'attacker-secret');
      expect(() => auth.verifyToken(forged)).toThrow();
    });
  });
});