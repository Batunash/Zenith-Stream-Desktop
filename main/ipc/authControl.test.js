import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const db = require('../../backend/src/config/database');
const bcrypt = require('bcryptjs');
const { ipcMain } = require('electron');

const registerAuthControl = require('./authControl');

describe('authControl', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.spyOn(db, 'getUserByUsername').mockReturnValue(null);
    vi.spyOn(db, 'createUser').mockImplementation(() => {});
    vi.spyOn(bcrypt, 'hash').mockResolvedValue('hashedPassword');
    vi.spyOn(bcrypt, 'compare').mockResolvedValue(true);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('registers auth IPC handlers', () => {
    registerAuthControl();
    const calls = ipcMain.handle.mock.calls.map((c) => c[0]);
    expect(calls).toContain('auth:register');
    expect(calls).toContain('auth:login');
  });

  describe('auth:register', () => {
    it('fails if username is already taken', async () => {
      registerAuthControl();
      const registerHandler = ipcMain.handle.mock.calls.find((c) => c[0] === 'auth:register')[1];

      db.getUserByUsername.mockReturnValue({ ID: 1, USERNAME: 'testuser' });

      const result = await registerHandler({}, { username: 'testuser', password: 'password123' });
      expect(result.success).toBe(false);
      expect(result.message).toContain('zaten');
    });

    it('succeeds and creates user if username is available', async () => {
      registerAuthControl();
      const registerHandler = ipcMain.handle.mock.calls.find((c) => c[0] === 'auth:register')[1];

      db.getUserByUsername.mockReturnValue(null);

      const result = await registerHandler({}, { username: 'testuser', password: 'password123' });
      expect(db.createUser).toHaveBeenCalledWith('testuser', 'hashedPassword');
      expect(result.success).toBe(true);
    });

    it('handles errors gracefully', async () => {
      registerAuthControl();
      const registerHandler = ipcMain.handle.mock.calls.find((c) => c[0] === 'auth:register')[1];

      db.getUserByUsername.mockImplementation(() => {
        throw new Error('DB Error');
      });

      const result = await registerHandler({}, { username: 'testuser', password: 'password123' });
      expect(result.success).toBe(false);
    });
  });

  describe('auth:login', () => {
    it('fails if user not found', async () => {
      registerAuthControl();
      const loginHandler = ipcMain.handle.mock.calls.find((c) => c[0] === 'auth:login')[1];

      db.getUserByUsername.mockReturnValue(null);

      const result = await loginHandler({}, { username: 'testuser', password: 'password123' });
      expect(result.success).toBe(false);
    });

    it('fails if password does not match', async () => {
      registerAuthControl();
      const loginHandler = ipcMain.handle.mock.calls.find((c) => c[0] === 'auth:login')[1];

      db.getUserByUsername.mockReturnValue({
        ID: 1,
        USERNAME: 'testuser',
        PASSWORD: 'hashedPassword',
      });
      bcrypt.compare.mockResolvedValue(false);

      const result = await loginHandler({}, { username: 'testuser', password: 'wrongpassword' });
      expect(result.success).toBe(false);
    });

    it('succeeds if credentials match', async () => {
      registerAuthControl();
      const loginHandler = ipcMain.handle.mock.calls.find((c) => c[0] === 'auth:login')[1];

      db.getUserByUsername.mockReturnValue({
        ID: 1,
        USERNAME: 'testuser',
        PASSWORD: 'hashedPassword',
      });
      bcrypt.compare.mockResolvedValue(true);

      const result = await loginHandler({}, { username: 'testuser', password: 'password123' });
      expect(result.success).toBe(true);
      expect(result.user.username).toBe('testuser');
    });

    it('handles errors gracefully during login', async () => {
      registerAuthControl();
      const loginHandler = ipcMain.handle.mock.calls.find((c) => c[0] === 'auth:login')[1];

      db.getUserByUsername.mockImplementation(() => {
        throw new Error('DB Error');
      });

      const result = await loginHandler({}, { username: 'testuser', password: 'password123' });
      expect(result.success).toBe(false);
      expect(result.message).toBe('Giriş işlemi başarısız.');
    });
  });
});
