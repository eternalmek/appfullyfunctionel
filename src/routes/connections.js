const express = require('express');
const prisma = require('../prismaClient');
const { authRequired } = require('../middleware/auth');
const { SimpleOAuth2 } = require('simple-oauth2'); // note: package usage below is handcrafted
const { URLSearchParams } = require('url');
require('dotenv').config();

const router = express.Router();

/**
 * GET /connections
 * returns map of connected apps for the logged in user
 */
router.get('/', authRequired, async (req, res) => {
  const userId = req.user.id;
  const rows = await prisma.connection.findMany({ where: { userId } });
  const obj = {};
  rows.forEach(r => obj[r.appId] = !!r.connected);
  res.json({ connections: obj });
});

/**
 * Toggle connection locally (simulate)
 * POST /connections/:appId/toggle
 */
router.post('/:appId/toggle', authRequired, async (req, res) => {
  const userId = req.user.id;
  const appId = req.params.appId;
  const existing = await prisma.connection.findUnique({ where: { userId_appId: { userId, appId } } });
  if (!existing) {
    const created = await prisma.connection.create({ data: { userId, appId, connected: true } });
    return res.json({ appId, connected: true });
  }
  const updated = await prisma.connection.update({ where: { id: existing.id }, data: { connected: !existing.connected } });
  res.json({ appId, connected: updated.connected });
});

/**
 * Start OAuth flow for provider (redirect to provider)
 * GET /connections/:appId/connect
 *
 * Note: This is a generic flow. For production you should use provider SDKs or passport strategies.
 */
router.get('/:appId/connect', authRequired, async (req, res) => {
  const appId = req.params.appId;
  const userId = req.user.id;

  // For facebook/instagram we expect FACEBOOK client credentials in env
  if (appId === 'facebook' || appId === 'instagram') {
    const clientId = process.env.OAUTH_FACEBOOK_CLIENT_ID;
    const redirectUri = process.env.OAUTH_FACEBOOK_CALLBACK_URL;
    const state = `${userId}:${appId}:${Math.random().toString(36).slice(2,8)}`;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      state,
      response_type: 'code',
      scope: 'pages_read_engagement,user_photos,user_videos,user_profile' // adjust scopes as needed
    });
    const url = `https://www.facebook.com/v16.0/dialog/oauth?${params.toString()}`;
    return res.redirect(url);
  }

  if (appId === 'tiktok') {
    const clientId = process.env.OAUTH_TIKTOK_CLIENT_ID;
    const redirectUri = process.env.OAUTH_TIKTOK_CALLBACK_URL;
    const state = `${userId}:${appId}:${Math.random().toString(36).slice(2,8)}`;
    const params = new URLSearchParams({
      client_key: clientId,
      redirect_uri: redirectUri,
      state,
      response_type: 'code',
      scope: 'user.info.basic,video.list' // adjust
    });
    const url = `https://open-api.tiktok.com/platform/oauth/connect?${params.toString()}`;
    return res.redirect(url);
  }

  res.status(400).json({ error: 'unsupported_app' });
});

/**
 * OAuth callback handlers - provider-specific token exchange and storing token
 * GET /connections/:appId/callback?code=...&state=...
 *
 * These routes exchange the code for a token and save to connections table.
 * You must register callback URLs with providers matching these endpoints.
 */
router.get('/:appId/callback', async (req, res) => {
  const appId = req.params.appId;
  const { code, state } = req.query;

  // state can contain userId and app
  // In production validate state properly.
  const parts = (state || '').split(':');
  const userId = parts[0];

  if (!userId) return res.status(400).send('missing_state_user');

  if (appId === 'facebook' || appId === 'instagram') {
    // Exchange code for access token
    const tokenRes = await fetch(`https://graph.facebook.com/v16.0/oauth/access_token?client_id=${process.env.OAUTH_FACEBOOK_CLIENT_ID}&client_secret=${process.env.OAUTH_FACEBOOK_CLIENT_SECRET}&redirect_uri=${encodeURIComponent(process.env.OAUTH_FACEBOOK_CALLBACK_URL)}&code=${code}`);
    const json = await tokenRes.json();
    if (json.error) return res.status(400).json({ error: json.error });
    const accessToken = json.access_token;
    await prisma.connection.upsert({ where: { userId_appId: { userId, appId } }, update: { connected: true, token: accessToken }, create: { userId, appId, connected: true, token: accessToken } });
    return res.send('Connected to Facebook/Instagram. You may close this window.');
  }

  if (appId === 'tiktok') {
    // Exchange code for token - TikTok token endpoint
    const tokenRes = await fetch('https://open-api.tiktok.com/oauth/access_token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_key: process.env.OAUTH_TIKTOK_CLIENT_ID,
        client_secret: process.env.OAUTH_TIKTOK_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code'
      })
    });
    const json = await tokenRes.json();
    if (json.data && json.data.access_token) {
      await prisma.connection.upsert({ where: { userId_appId: { userId, appId } }, update: { connected: true, token: json.data.access_token }, create: { userId, appId, connected: true, token: json.data.access_token } });
      return res.send('Connected to TikTok. You may close this window.');
    }
    return res.status(400).json({ error: json });
  }

  res.status(400).json({ error: 'unsupported_app' });
});

module.exports = router;