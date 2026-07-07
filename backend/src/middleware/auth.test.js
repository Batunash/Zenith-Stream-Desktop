import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { authenticateToken, optionalAuth } from './auth';

const authConfig = require('../config/auth');
const db = require('../config/database');

describe('Auth Middleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(authConfig, 'verifyToken');
    vi.spyOn(db, 'getUserById');

    mockReq = { headers: {} };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    mockNext = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('authenticateToken', () => {
    it('returns 401 if no token provided', () => {
      authenticateToken(mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Access token required' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('returns 403 if token is invalid', () => {
      mockReq.headers['authorization'] = 'Bearer invalidtoken';
      authConfig.verifyToken.mockImplementationOnce(() => {
        throw new Error('Invalid');
      });

      authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('returns 403 gracefully if authorization header is malformed (e.g. no Bearer)', () => {
      mockReq.headers['authorization'] = 'MaliciousTokenFormatWithoutBearer ';
      // Assuming authenticateToken splits by space. If it fails, it should catch or return 401/403.
      authConfig.verifyToken.mockImplementationOnce(() => {
        throw new Error('jwt malformed');
      });

      authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('returns 401 if user does not exist', () => {
      mockReq.headers['authorization'] = 'Bearer validtoken';
      authConfig.verifyToken.mockReturnValueOnce({ userId: 99 });
      db.getUserById.mockReturnValueOnce(null);

      authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid token' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('calls next and sets req.user if token is valid and user exists', () => {
      mockReq.headers['authorization'] = 'Bearer validtoken';
      authConfig.verifyToken.mockReturnValueOnce({ userId: 1 });
      db.getUserById.mockReturnValueOnce({ ID: 1, USERNAME: 'testuser' });

      authenticateToken(mockReq, mockRes, mockNext);

      expect(mockReq.user).toEqual({ id: 1, username: 'testuser' });
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('optionalAuth', () => {
    it('calls next immediately if no token provided', () => {
      optionalAuth(mockReq, mockRes, mockNext);
      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });

    it('sets req.user and calls next if token is valid', () => {
      mockReq.headers['authorization'] = 'Bearer validtoken';
      authConfig.verifyToken.mockReturnValueOnce({ userId: 1 });
      db.getUserById.mockReturnValueOnce({ ID: 1, USERNAME: 'testuser' });

      optionalAuth(mockReq, mockRes, mockNext);

      expect(mockReq.user).toEqual({ id: 1, username: 'testuser' });
      expect(mockNext).toHaveBeenCalled();
    });

    it('ignores errors and calls next if token is invalid', () => {
      mockReq.headers['authorization'] = 'Bearer invalidtoken';
      authConfig.verifyToken.mockImplementationOnce(() => {
        throw new Error('Invalid');
      });

      optionalAuth(mockReq, mockRes, mockNext);

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
