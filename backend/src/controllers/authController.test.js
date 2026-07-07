import { describe, it, expect, vi, beforeEach } from 'vitest';

const dbMocks = vi.hoisted(() => ({
    getUserByUsername: vi.fn(),
    createUser:        vi.fn()
}));

const authMocks = vi.hoisted(() => ({
    generateToken:  vi.fn().mockReturnValue('mock-token'),
    verifyToken:    vi.fn().mockReturnValue({ userId: 1 }),
    JWT_SECRET:     'test-secret',
    JWT_EXPIRES_IN: '7d'
}));

vi.mock('../config/database', () => ({ ...dbMocks }));
vi.mock('../config/auth',     () => ({ ...authMocks }));

// Manual require.cache injection for CJS interop on Windows
const _p   = require('path');
const _cwd = process.cwd();
const _dbPath   = _p.resolve(_cwd, 'backend/src/config/database.js');
const _authPath = _p.resolve(_cwd, 'backend/src/config/auth.js');

require.cache[_dbPath]   = { id: _dbPath,   filename: _dbPath,   loaded: true, exports: dbMocks,   children: [], paths: [] };
require.cache[_authPath] = { id: _authPath, filename: _authPath, loaded: true, exports: authMocks, children: [], paths: [] };

// bcryptjs is intercepted by Module.prototype.require → global.__bcryptMock
const { register, login } = require('./authController');

describe('Auth Controller', () => {
    let mockReq;
    let mockRes;
    let bcrypt;

    beforeEach(() => {
        vi.clearAllMocks();
        bcrypt = global.__bcryptMock;

        mockReq = { body: { username: 'user', password: 'password123' } };
        mockRes = {
            status: vi.fn().mockReturnThis(),
            json:   vi.fn()
        };
    });

    describe('register', () => {
        it('returns 400 if missing username', async () => {
            mockReq.body.username = '';
            await register(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(400);
        });

        it('returns 400 if password is too short', async () => {
            mockReq.body.password = '123';
            await register(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(400);
        });

        it('returns 409 if username already exists', async () => {
            dbMocks.getUserByUsername.mockReturnValueOnce({ ID: 1, USERNAME: 'user' });
            await register(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(409);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Username already exists' });
        });

        it('registers user and returns 201', async () => {
            dbMocks.getUserByUsername
                .mockReturnValueOnce(null)
                .mockReturnValueOnce({ ID: 1, USERNAME: 'newuser' });
            bcrypt.hash.mockResolvedValueOnce('hashed_pass');
            authMocks.generateToken.mockReturnValueOnce('mocktoken');

            mockReq.body.username = 'newuser';
            await register(mockReq, mockRes);

            expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
            expect(dbMocks.createUser).toHaveBeenCalledWith('newuser', 'hashed_pass');
            expect(mockRes.status).toHaveBeenCalledWith(201);
            expect(mockRes.json).toHaveBeenCalledWith({
                message: 'User registered successfully',
                user:    { id: 1, username: 'newuser' },
                token:   'mocktoken'
            });
        });

        it('handles exceptions in register', async () => {
            dbMocks.getUserByUsername.mockImplementationOnce(() => { throw new Error('DB Error'); });
            await register(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Registration failed' });
        });
    });

    describe('login', () => {
        it('returns 400 if missing password', async () => {
            mockReq.body.password = '';
            await login(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(400);
        });

        it('returns 401 if user not found', async () => {
            dbMocks.getUserByUsername.mockReturnValueOnce(null);
            await login(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
        });

        it('returns 401 if password is wrong', async () => {
            dbMocks.getUserByUsername.mockReturnValueOnce({ ID: 1, USERNAME: 'user', PASSWORD: 'hashed' });
            bcrypt.compare.mockResolvedValueOnce(false);
            await login(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(401);
        });

        it('logs in successfully', async () => {
            dbMocks.getUserByUsername.mockReturnValueOnce({ ID: 1, USERNAME: 'user', PASSWORD: 'hashed' });
            bcrypt.compare.mockResolvedValueOnce(true);
            authMocks.generateToken.mockReturnValueOnce('validtoken');

            await login(mockReq, mockRes);
            expect(mockRes.json).toHaveBeenCalledWith({
                message: 'Login successful',
                user:    { id: 1, username: 'user' },
                token:   'validtoken'
            });
        });

        it('handles exceptions in login', async () => {
            dbMocks.getUserByUsername.mockImplementationOnce(() => { throw new Error('DB Error'); });
            await login(mockReq, mockRes);
            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.json).toHaveBeenCalledWith({ error: 'Login failed' });
        });
    });
});
