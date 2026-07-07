const bcrypt = require('bcryptjs');
const { generateToken } = require('../config/auth');
const db = require('../config/database');
async function register(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: 'Password too short' });
    }

    const existingUser = db.getUserByUsername(username);
    if (existingUser) {
      return res.status(409).json({ error: 'Username already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    db.createUser(username, hashedPassword);
    const newUser = db.getUserByUsername(username);
    const token = generateToken(newUser.ID);

    res.status(201).json({
      message: 'User registered successfully',
      user: { id: newUser.ID, username },
      token,
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
}
async function login(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    const user = db.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const validPassword = await bcrypt.compare(password, user.PASSWORD);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = generateToken(user.ID);
    res.json({
      message: 'Login successful',
      user: { id: user.ID, username: user.USERNAME },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
}
function getProfile(req, res) {
  res.json({ user: req.user });
}
module.exports = { register, login, getProfile };
