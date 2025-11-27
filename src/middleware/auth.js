const jwt = require('jsonwebtoken');
const prisma = require('../prismaClient');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'secret';
const ACCESS_EXPIRES = process.env.ACCESS_TOKEN_EXPIRES_IN || '15m';
const REFRESH_EXPIRES_DAYS = Number((process.env.REFRESH_TOKEN_EXPIRES_IN || '30d').replace('d','')) || 30;

function signAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_EXPIRES });
}

function verifyAccessToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

function authRequired(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'token_missing' });
  const token = auth.split(' ')[1];
  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'token_invalid', details: err.message });
  }
}

async function createRefreshToken(userId) {
  const token = require('crypto').randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_EXPIRES_DAYS * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({ data: { userId, token, expiresAt } });
  return token;
}

async function revokeRefreshToken(token) {
  await prisma.refreshToken.updateMany({ where: { token }, data: { revoked: true } });
}

async function rotateRefreshToken(oldToken, userId) {
  // revoke old and create new
  await revokeRefreshToken(oldToken);
  return createRefreshToken(userId);
}

module.exports = { signAccessToken, authRequired, createRefreshToken, revokeRefreshToken, rotateRefreshToken, verifyAccessToken };