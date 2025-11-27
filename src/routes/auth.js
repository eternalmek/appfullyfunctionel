const express = require('express');
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../prismaClient');
const { signAccessToken, createRefreshToken, revokeRefreshToken } = require('../middleware/auth');
const jwt = require('jsonwebtoken');
const { URLSearchParams } = require('url');
require('dotenv').config();

const router = express.Router();

// Store pending OAuth states for login validation (in production use Redis or database)
const pendingLoginStates = new Map();
const STATE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

/**
 * OAuth configuration for social login
 */
const OAUTH_LOGIN_CONFIG = {
  facebook: {
    clientId: process.env.OAUTH_FACEBOOK_CLIENT_ID,
    clientSecret: process.env.OAUTH_FACEBOOK_CLIENT_SECRET,
    callbackUrl: process.env.OAUTH_FACEBOOK_LOGIN_CALLBACK_URL || (process.env.OAUTH_FACEBOOK_CALLBACK_URL ? process.env.OAUTH_FACEBOOK_CALLBACK_URL.replace('/connections/', '/auth/') : null),
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    userInfoUrl: 'https://graph.facebook.com/v18.0/me',
    scopes: ['public_profile', 'email'],
    configured: !!(process.env.OAUTH_FACEBOOK_CLIENT_ID && process.env.OAUTH_FACEBOOK_CLIENT_SECRET)
  },
  instagram: {
    clientId: process.env.OAUTH_INSTAGRAM_CLIENT_ID || process.env.OAUTH_FACEBOOK_CLIENT_ID,
    clientSecret: process.env.OAUTH_INSTAGRAM_CLIENT_SECRET || process.env.OAUTH_FACEBOOK_CLIENT_SECRET,
    callbackUrl: process.env.OAUTH_INSTAGRAM_LOGIN_CALLBACK_URL || (process.env.OAUTH_INSTAGRAM_CALLBACK_URL ? process.env.OAUTH_INSTAGRAM_CALLBACK_URL.replace('/connections/', '/auth/') : null),
    authUrl: 'https://api.instagram.com/oauth/authorize',
    tokenUrl: 'https://api.instagram.com/oauth/access_token',
    userInfoUrl: 'https://graph.instagram.com/me',
    scopes: ['user_profile'],
    configured: !!(process.env.OAUTH_FACEBOOK_CLIENT_ID || process.env.OAUTH_INSTAGRAM_CLIENT_ID)
  },
  tiktok: {
    clientId: process.env.OAUTH_TIKTOK_CLIENT_ID,
    clientSecret: process.env.OAUTH_TIKTOK_CLIENT_SECRET,
    callbackUrl: process.env.OAUTH_TIKTOK_LOGIN_CALLBACK_URL || (process.env.OAUTH_TIKTOK_CALLBACK_URL ? process.env.OAUTH_TIKTOK_CALLBACK_URL.replace('/connections/', '/auth/') : null),
    authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    userInfoUrl: 'https://open.tiktokapis.com/v2/user/info/',
    scopes: ['user.info.basic'],
    configured: !!(process.env.OAUTH_TIKTOK_CLIENT_ID && process.env.OAUTH_TIKTOK_CLIENT_SECRET)
  }
};

/**
 * GET /auth/oauth/config
 * Returns which OAuth providers are configured for social login
 */
router.get('/oauth/config', (req, res) => {
  const configStatus = {};
  Object.keys(OAUTH_LOGIN_CONFIG).forEach(provider => {
    configStatus[provider] = OAUTH_LOGIN_CONFIG[provider].configured;
  });
  res.json({ configStatus });
});

/**
 * POST /auth/oauth/:provider/init
 * Initialize OAuth login flow - returns OAuth URL
 */
router.post('/oauth/:provider/init', async (req, res) => {
  const provider = req.params.provider;
  const config = OAUTH_LOGIN_CONFIG[provider];
  
  if (!config) {
    return res.status(400).json({ error: 'unsupported_provider', message: `Provider "${provider}" is not supported` });
  }
  
  if (!config.configured) {
    return res.status(400).json({ 
      error: 'oauth_not_configured', 
      message: `OAuth credentials for ${provider} are not configured.`
    });
  }

  // Generate cryptographically secure state parameter
  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  const stateData = { provider, nonce, timestamp, type: 'login' };
  const state = Buffer.from(JSON.stringify(stateData)).toString('base64url');
  
  // Clean up expired states
  for (const [key, value] of pendingLoginStates.entries()) {
    if (Date.now() - value.timestamp > STATE_EXPIRY_MS) {
      pendingLoginStates.delete(key);
    }
  }
  pendingLoginStates.set(nonce, stateData);

  let oauthUrl;
  
  if (provider === 'facebook') {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.callbackUrl,
      state,
      response_type: 'code',
      scope: config.scopes.join(',')
    });
    oauthUrl = `${config.authUrl}?${params.toString()}`;
  } else if (provider === 'instagram') {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.callbackUrl,
      state,
      response_type: 'code',
      scope: config.scopes.join(',')
    });
    oauthUrl = `${config.authUrl}?${params.toString()}`;
  } else if (provider === 'tiktok') {
    const params = new URLSearchParams({
      client_key: config.clientId,
      redirect_uri: config.callbackUrl,
      state,
      response_type: 'code',
      scope: config.scopes.join(',')
    });
    oauthUrl = `${config.authUrl}?${params.toString()}`;
  }

  if (oauthUrl) {
    return res.json({ success: true, oauthUrl });
  }
  
  res.status(400).json({ error: 'unsupported_provider' });
});

/**
 * Parse and validate state parameter from OAuth callback
 */
function parseAndValidateLoginState(state) {
  if (!state || typeof state !== 'string') {
    return null;
  }
  
  try {
    const stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    
    if (!stateData.provider || !stateData.nonce || !stateData.timestamp || stateData.type !== 'login') {
      return null;
    }
    
    if (Date.now() - stateData.timestamp > STATE_EXPIRY_MS) {
      console.warn('OAuth login state expired');
      return null;
    }
    
    const storedState = pendingLoginStates.get(stateData.nonce);
    if (!storedState || storedState.provider !== stateData.provider) {
      console.warn('OAuth login state validation failed');
      return null;
    }
    
    pendingLoginStates.delete(stateData.nonce);
    
    return stateData;
  } catch {
    return null;
  }
}

/**
 * Generate unique handle from name
 */
async function generateUniqueHandle(baseName) {
  const baseHandle = baseName.toLowerCase().replace(/[^a-z0-9]/g, '_').substring(0, 20);
  let handle = baseHandle;
  let suffix = 1;
  
  while (await prisma.user.findUnique({ where: { handle } })) {
    handle = `${baseHandle}_${suffix}`;
    suffix++;
  }
  
  return handle;
}

/**
 * GET /auth/oauth/:provider/callback
 * OAuth callback handler for social login
 */
router.get('/oauth/:provider/callback', async (req, res) => {
  const provider = req.params.provider;
  const { code, state, error, error_description } = req.query;
  const config = OAUTH_LOGIN_CONFIG[provider];
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  if (error) {
    console.error(`OAuth login error for ${provider}:`, error, error_description);
    return res.redirect(`${frontendUrl}?oauth_error=${encodeURIComponent(error_description || error)}`);
  }

  const stateData = parseAndValidateLoginState(state);
  
  if (!stateData) {
    return res.redirect(`${frontendUrl}?oauth_error=${encodeURIComponent('Invalid or expired authorization state')}`);
  }

  try {
    let accessToken, userInfo;

    if (provider === 'facebook') {
      // Exchange code for token
      const tokenRes = await fetch(`${config.tokenUrl}?client_id=${config.clientId}&client_secret=${config.clientSecret}&redirect_uri=${encodeURIComponent(config.callbackUrl)}&code=${code}`);
      const tokenJson = await tokenRes.json();
      if (tokenJson.error) throw new Error(tokenJson.error.message || tokenJson.error);
      accessToken = tokenJson.access_token;

      // Get user info
      const userRes = await fetch(`${config.userInfoUrl}?fields=id,name,email,picture&access_token=${accessToken}`);
      userInfo = await userRes.json();
      if (userInfo.error) throw new Error(userInfo.error.message);
    } else if (provider === 'instagram') {
      // Exchange code for token
      const tokenRes = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          grant_type: 'authorization_code',
          redirect_uri: config.callbackUrl,
          code
        })
      });
      const tokenJson = await tokenRes.json();
      if (tokenJson.error_type) throw new Error(tokenJson.error_message || tokenJson.error_type);
      accessToken = tokenJson.access_token;

      // Get user info
      const userRes = await fetch(`${config.userInfoUrl}?fields=id,username&access_token=${accessToken}`);
      userInfo = await userRes.json();
      if (userInfo.error) throw new Error(userInfo.error.message);
      userInfo.name = userInfo.username;
    } else if (provider === 'tiktok') {
      // Exchange code for token
      const tokenRes = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_key: config.clientId,
          client_secret: config.clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: config.callbackUrl
        })
      });
      const tokenJson = await tokenRes.json();
      if (tokenJson.error || !tokenJson.access_token) throw new Error(tokenJson.error?.message || 'Failed to get access token');
      accessToken = tokenJson.access_token;

      // Get user info
      const userRes = await fetch(`${config.userInfoUrl}?fields=open_id,display_name,avatar_url`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const userData = await userRes.json();
      if (userData.error?.code) throw new Error(userData.error.message);
      userInfo = {
        id: userData.data?.user?.open_id,
        name: userData.data?.user?.display_name || `tiktok_user_${Date.now()}`,
        avatar: userData.data?.user?.avatar_url
      };
    }

    // Create email for OAuth users (they don't have a real email from some providers)
    const oauthEmail = userInfo.email || `${provider}_${userInfo.id}@oauth.eternalme.app`;
    
    // Find or create user
    let user = await prisma.user.findUnique({ where: { email: oauthEmail } });
    
    if (!user) {
      const handle = await generateUniqueHandle(userInfo.name || provider);
      user = await prisma.user.create({
        data: {
          email: oauthEmail,
          name: userInfo.name || `${provider} User`,
          handle,
          avatar: userInfo.picture?.data?.url || userInfo.avatar || null
        }
      });
    }

    // Generate tokens
    const jwtToken = signAccessToken({ id: user.id, email: user.email });
    const refreshToken = await createRefreshToken(user.id);

    // Redirect to frontend with tokens (using fragment to avoid server logs)
    return res.redirect(`${frontendUrl}?oauth_success=true#access_token=${jwtToken}&refresh_token=${refreshToken}&user=${encodeURIComponent(JSON.stringify({ id: user.id, name: user.name, email: user.email, handle: user.handle, avatar: user.avatar }))}`);
  } catch (err) {
    console.error(`OAuth login callback error for ${provider}:`, err);
    return res.redirect(`${frontendUrl}?oauth_error=${encodeURIComponent(err.message)}`);
  }
});

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