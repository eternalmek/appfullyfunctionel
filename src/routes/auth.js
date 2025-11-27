const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const prisma = require('../prismaClient');
const { signAccessToken, createRefreshToken, revokeRefreshToken } = require('../middleware/auth');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const router = express.Router();

// Register (email/password)
router.post('/register',
  body('email').isEmail(),
  body('password').isLength({ min: 6 }),
  body('name').optional().isString(),
  async (req, res) => {
    const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { email, password, name } = req.body;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'email_taken' });
    const handle = email.split('@')[0];
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, name: name || handle, handle, passwordHash } });
    const accessToken = signAccessToken({ id: user.id, email: user.email });
    const refreshToken = await createRefreshToken(user.id);
    res.json({ accessToken, refreshToken, user: { id: user.id, name: user.name, email: user.email, handle: user.handle, avatar: user.avatar } });
  }
);

// Login (email/password)
router.post('/login',
  body('email').isEmail(),
  body('password').notEmpty(),
  async (req, res) => {
    const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) return res.status(401).json({ error: 'invalid_credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'invalid_credentials' });
    const accessToken = signAccessToken({ id: user.id, email: user.email });
    const refreshToken = await createRefreshToken(user.id);
    res.json({ accessToken, refreshToken, user: { id: user.id, name: user.name, email: user.email, handle: user.handle, avatar: user.avatar } });
  }
);

// Refresh token
router.post('/refresh', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'missing_refresh' });
  const tokenRow = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
  if (!tokenRow || tokenRow.revoked || tokenRow.expiresAt < new Date()) return res.status(401).json({ error: 'invalid_refresh' });
  const user = await prisma.user.findUnique({ where: { id: tokenRow.userId } });
  if (!user) return res.status(401).json({ error: 'invalid_user' });
  // rotate refresh token
  await prisma.refreshToken.update({ where: { token: refreshToken }, data: { revoked: true } });
  const newRefresh = await require('../middleware/auth').createRefreshToken(user.id);
  const accessToken = signAccessToken({ id: user.id, email: user.email });
  res.json({ accessToken, refreshToken: newRefresh });
});

// Logout (revoke refresh)
router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body;
  if (refreshToken) await revokeRefreshToken(refreshToken);
  res.json({ ok: true });
});

// Me
router.get('/me', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.json({ user: null });
  const token = auth.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) return res.json({ user: null });
    res.json({ user: { id: user.id, name: user.name, handle: user.handle, email: user.email, avatar: user.avatar } });
  } catch (err) {
    res.json({ user: null });
  }
});

module.exports = router;