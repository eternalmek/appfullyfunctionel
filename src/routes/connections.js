const express = require('express');
const crypto = require('crypto');
const prisma = require('../prismaClient');
const { authRequired } = require('../middleware/auth');
const { URLSearchParams } = require('url');
require('dotenv').config();

const router = express.Router();

// Store pending OAuth states for validation (in production use Redis or database)
const pendingStates = new Map();
const STATE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

/**
 * OAuth configuration for supported providers
 * These require proper credentials in environment variables to function
 */
const OAUTH_CONFIG = {
  facebook: {
    clientId: process.env.OAUTH_FACEBOOK_CLIENT_ID,
    clientSecret: process.env.OAUTH_FACEBOOK_CLIENT_SECRET,
    callbackUrl: process.env.OAUTH_FACEBOOK_CALLBACK_URL,
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    tokenUrl: 'https://graph.facebook.com/v18.0/oauth/access_token',
    scopes: ['public_profile', 'user_photos', 'user_videos'],
    configured: !!(process.env.OAUTH_FACEBOOK_CLIENT_ID && process.env.OAUTH_FACEBOOK_CLIENT_SECRET)
  },
  instagram: {
    clientId: process.env.OAUTH_INSTAGRAM_CLIENT_ID || process.env.OAUTH_FACEBOOK_CLIENT_ID,
    clientSecret: process.env.OAUTH_INSTAGRAM_CLIENT_SECRET || process.env.OAUTH_FACEBOOK_CLIENT_SECRET,
    callbackUrl: process.env.OAUTH_INSTAGRAM_CALLBACK_URL || process.env.OAUTH_FACEBOOK_CALLBACK_URL,
    authUrl: 'https://api.instagram.com/oauth/authorize',
    tokenUrl: 'https://api.instagram.com/oauth/access_token',
    scopes: ['user_profile', 'user_media'],
    configured: !!(process.env.OAUTH_FACEBOOK_CLIENT_ID || process.env.OAUTH_INSTAGRAM_CLIENT_ID)
  },
  tiktok: {
    clientId: process.env.OAUTH_TIKTOK_CLIENT_ID,
    clientSecret: process.env.OAUTH_TIKTOK_CLIENT_SECRET,
    callbackUrl: process.env.OAUTH_TIKTOK_CALLBACK_URL,
    authUrl: 'https://www.tiktok.com/v2/auth/authorize/',
    tokenUrl: 'https://open.tiktokapis.com/v2/oauth/token/',
    scopes: ['user.info.basic', 'video.list'],
    configured: !!(process.env.OAUTH_TIKTOK_CLIENT_ID && process.env.OAUTH_TIKTOK_CLIENT_SECRET)
  },
  photos: {
    clientId: process.env.OAUTH_GOOGLE_CLIENT_ID,
    clientSecret: process.env.OAUTH_GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.OAUTH_GOOGLE_CALLBACK_URL,
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    scopes: ['https://www.googleapis.com/auth/photoslibrary.readonly'],
    configured: !!(process.env.OAUTH_GOOGLE_CLIENT_ID && process.env.OAUTH_GOOGLE_CLIENT_SECRET)
  }
};

/**
 * GET /connections
 * returns map of connected apps for the logged in user with configuration status
 */
router.get('/', authRequired, async (req, res) => {
  const userId = req.user.id;
  const rows = await prisma.connection.findMany({ where: { userId } });
  const connections = {};
  const configStatus = {};
  
  rows.forEach(r => {
    connections[r.appId] = !!r.connected;
  });
  
  // Add configuration status so frontend knows if OAuth is available
  Object.keys(OAUTH_CONFIG).forEach(appId => {
    configStatus[appId] = OAUTH_CONFIG[appId].configured;
  });
  
  res.json({ connections, configStatus });
});

/**
 * Toggle connection locally (for demo mode when OAuth is not configured)
 * POST /connections/:appId/toggle
 */
router.post('/:appId/toggle', authRequired, async (req, res) => {
  const userId = req.user.id;
  const appId = req.params.appId;
  
  // If OAuth is configured for this app, don't allow simple toggle
  if (OAUTH_CONFIG[appId]?.configured) {
    return res.status(400).json({ 
      error: 'oauth_required', 
      message: 'This app requires OAuth authentication. Use /connections/:appId/connect to start the flow.',
      connectUrl: `/connections/${appId}/connect`
    });
  }
  
  const existing = await prisma.connection.findUnique({ where: { userId_appId: { userId, appId } } });
  if (!existing) {
    await prisma.connection.create({ data: { userId, appId, connected: true } });
    return res.json({ appId, connected: true, mode: 'demo' });
  }
  const updated = await prisma.connection.update({ where: { id: existing.id }, data: { connected: !existing.connected, token: null } });
  res.json({ appId, connected: updated.connected, mode: 'demo' });
});

/**
 * Initialize OAuth flow - returns OAuth URL instead of redirecting
 * POST /connections/:appId/init
 * 
 * This allows the frontend to open the OAuth URL in a popup without exposing tokens in URLs
 */
router.post('/:appId/init', authRequired, async (req, res) => {
  const appId = req.params.appId;
  const userId = req.user.id;
  const config = OAUTH_CONFIG[appId];
  
  if (!config) {
    return res.status(400).json({ error: 'unsupported_app', message: `App "${appId}" is not supported` });
  }
  
  if (!config.configured) {
    return res.status(400).json({ 
      error: 'oauth_not_configured', 
      message: `OAuth credentials for ${appId} are not configured.`
    });
  }

  // Generate cryptographically secure state parameter
  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  const stateData = { userId, appId, nonce, timestamp };
  const state = Buffer.from(JSON.stringify(stateData)).toString('base64url');
  
  // Store state for validation
  for (const [key, value] of pendingStates.entries()) {
    if (Date.now() - value.timestamp > STATE_EXPIRY_MS) {
      pendingStates.delete(key);
    }
  }
  pendingStates.set(nonce, stateData);

  let oauthUrl;
  
  if (appId === 'facebook' || appId === 'instagram') {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.callbackUrl,
      state,
      response_type: 'code',
      scope: config.scopes.join(',')
    });
    oauthUrl = `${config.authUrl}?${params.toString()}`;
  } else if (appId === 'tiktok') {
    const params = new URLSearchParams({
      client_key: config.clientId,
      redirect_uri: config.callbackUrl,
      state,
      response_type: 'code',
      scope: config.scopes.join(',')
    });
    oauthUrl = `${config.authUrl}?${params.toString()}`;
  } else if (appId === 'photos') {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.callbackUrl,
      state,
      response_type: 'code',
      scope: config.scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent'
    });
    oauthUrl = `${config.authUrl}?${params.toString()}`;
  }

  if (oauthUrl) {
    return res.json({ success: true, oauthUrl });
  }
  
  res.status(400).json({ error: 'unsupported_app' });
});

/**
 * Start OAuth flow for provider (redirect to provider)
 * GET /connections/:appId/connect
 *
 * Note: Requires proper OAuth credentials in environment variables.
 */
router.get('/:appId/connect', authRequired, async (req, res) => {
  const appId = req.params.appId;
  const userId = req.user.id;
  const config = OAUTH_CONFIG[appId];
  
  if (!config) {
    return res.status(400).json({ error: 'unsupported_app', message: `App "${appId}" is not supported` });
  }
  
  if (!config.configured) {
    return res.status(400).json({ 
      error: 'oauth_not_configured', 
      message: `OAuth credentials for ${appId} are not configured. Please add the required environment variables.`,
      required: appId === 'facebook' || appId === 'instagram' 
        ? ['OAUTH_FACEBOOK_CLIENT_ID', 'OAUTH_FACEBOOK_CLIENT_SECRET', 'OAUTH_FACEBOOK_CALLBACK_URL']
        : appId === 'tiktok'
        ? ['OAUTH_TIKTOK_CLIENT_ID', 'OAUTH_TIKTOK_CLIENT_SECRET', 'OAUTH_TIKTOK_CALLBACK_URL']
        : ['OAUTH_GOOGLE_CLIENT_ID', 'OAUTH_GOOGLE_CLIENT_SECRET', 'OAUTH_GOOGLE_CALLBACK_URL']
    });
  }

  // Generate cryptographically secure state parameter
  const nonce = crypto.randomBytes(16).toString('hex');
  const timestamp = Date.now();
  const stateData = { userId, appId, nonce, timestamp };
  const state = Buffer.from(JSON.stringify(stateData)).toString('base64url');
  
  // Store state for validation (cleanup expired states)
  for (const [key, value] of pendingStates.entries()) {
    if (Date.now() - value.timestamp > STATE_EXPIRY_MS) {
      pendingStates.delete(key);
    }
  }
  pendingStates.set(nonce, stateData);

  if (appId === 'facebook') {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.callbackUrl,
      state,
      response_type: 'code',
      scope: config.scopes.join(',')
    });
    return res.redirect(`${config.authUrl}?${params.toString()}`);
  }

  if (appId === 'instagram') {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.callbackUrl,
      state,
      response_type: 'code',
      scope: config.scopes.join(',')
    });
    return res.redirect(`${config.authUrl}?${params.toString()}`);
  }

  if (appId === 'tiktok') {
    const params = new URLSearchParams({
      client_key: config.clientId,
      redirect_uri: config.callbackUrl,
      state,
      response_type: 'code',
      scope: config.scopes.join(',')
    });
    return res.redirect(`${config.authUrl}?${params.toString()}`);
  }

  if (appId === 'photos') {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.callbackUrl,
      state,
      response_type: 'code',
      scope: config.scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent'
    });
    return res.redirect(`${config.authUrl}?${params.toString()}`);
  }

  res.status(400).json({ error: 'unsupported_app' });
});

/**
 * Parse and validate state parameter from OAuth callback
 * Returns null if validation fails
 */
function parseAndValidateState(state) {
  if (!state || typeof state !== 'string') {
    return null;
  }
  
  try {
    const stateData = JSON.parse(Buffer.from(state, 'base64url').toString());
    
    // Validate required fields exist
    if (!stateData.userId || !stateData.appId || !stateData.nonce || !stateData.timestamp) {
      return null;
    }
    
    // Validate types
    if (typeof stateData.userId !== 'string' || 
        typeof stateData.appId !== 'string' || 
        typeof stateData.nonce !== 'string' ||
        typeof stateData.timestamp !== 'number') {
      return null;
    }
    
    // Validate timestamp is not expired (10 minutes max)
    if (Date.now() - stateData.timestamp > STATE_EXPIRY_MS) {
      console.warn('OAuth state expired');
      return null;
    }
    
    // Validate against stored state to prevent replay attacks
    const storedState = pendingStates.get(stateData.nonce);
    if (!storedState || 
        storedState.userId !== stateData.userId || 
        storedState.appId !== stateData.appId) {
      console.warn('OAuth state validation failed - possible replay attack');
      return null;
    }
    
    // Remove used state to prevent reuse
    pendingStates.delete(stateData.nonce);
    
    return stateData;
  } catch {
    return null;
  }
}

/**
 * OAuth callback handlers - provider-specific token exchange and storing token
 * GET /connections/:appId/callback?code=...&state=...
 *
 * These routes exchange the code for a token and save to connections table.
 * You must register callback URLs with providers matching these endpoints.
 */
router.get('/:appId/callback', async (req, res) => {
  const appId = req.params.appId;
  const { code, state, error, error_description } = req.query;
  const config = OAUTH_CONFIG[appId];

  if (error) {
    console.error(`OAuth error for ${appId}:`, error, error_description);
    return res.status(400).send(`
      <html>
        <head><title>Connection Failed</title></head>
        <body style="font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0a0a0a; color: white;">
          <div style="text-align: center; padding: 2rem;">
            <h2>Connection Failed</h2>
            <p style="color: #999;">${error_description || error}</p>
            <p style="margin-top: 2rem;"><a href="javascript:window.close()" style="color: #06b6d4;">Close this window</a></p>
          </div>
        </body>
      </html>
    `);
  }

  const stateData = parseAndValidateState(state);
  
  if (!stateData) {
    return res.status(400).send(`
      <html>
        <head><title>Connection Failed</title></head>
        <body style="font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0a0a0a; color: white;">
          <div style="text-align: center; padding: 2rem;">
            <h2>Connection Failed</h2>
            <p style="color: #999;">Invalid or expired authorization state. Please try again.</p>
            <p style="margin-top: 2rem;"><a href="javascript:window.close()" style="color: #06b6d4;">Close this window</a></p>
          </div>
        </body>
      </html>
    `);
  }
  
  const userId = stateData.userId;

  try {
    if (appId === 'facebook') {
      const tokenRes = await fetch(`${config.tokenUrl}?client_id=${config.clientId}&client_secret=${config.clientSecret}&redirect_uri=${encodeURIComponent(config.callbackUrl)}&code=${code}`);
      const json = await tokenRes.json();
      if (json.error) throw new Error(json.error.message || json.error);
      
      await prisma.connection.upsert({ 
        where: { userId_appId: { userId, appId } }, 
        update: { connected: true, token: json.access_token }, 
        create: { userId, appId, connected: true, token: json.access_token } 
      });
      
      return res.send(successPage('Facebook'));
    }

    if (appId === 'instagram') {
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
      const json = await tokenRes.json();
      if (json.error_type) throw new Error(json.error_message || json.error_type);
      
      await prisma.connection.upsert({ 
        where: { userId_appId: { userId, appId } }, 
        update: { connected: true, token: json.access_token }, 
        create: { userId, appId, connected: true, token: json.access_token } 
      });
      
      return res.send(successPage('Instagram'));
    }

    if (appId === 'tiktok') {
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
      const json = await tokenRes.json();
      if (json.error || !json.access_token) throw new Error(json.error?.message || 'Failed to get access token');
      
      await prisma.connection.upsert({ 
        where: { userId_appId: { userId, appId } }, 
        update: { connected: true, token: json.access_token }, 
        create: { userId, appId, connected: true, token: json.access_token } 
      });
      
      return res.send(successPage('TikTok'));
    }

    if (appId === 'photos') {
      const tokenRes = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: config.clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: config.callbackUrl
        })
      });
      const json = await tokenRes.json();
      if (json.error) throw new Error(json.error_description || json.error);
      
      await prisma.connection.upsert({ 
        where: { userId_appId: { userId, appId } }, 
        update: { connected: true, token: json.access_token }, 
        create: { userId, appId, connected: true, token: json.access_token } 
      });
      
      return res.send(successPage('Google Photos'));
    }

    res.status(400).json({ error: 'unsupported_app' });
  } catch (err) {
    console.error(`OAuth callback error for ${appId}:`, err);
    return res.status(400).send(`
      <html>
        <head><title>Connection Failed</title></head>
        <body style="font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0a0a0a; color: white;">
          <div style="text-align: center; padding: 2rem;">
            <h2>Connection Failed</h2>
            <p style="color: #999;">${err.message}</p>
            <p style="margin-top: 2rem;"><a href="javascript:window.close()" style="color: #06b6d4;">Close this window</a></p>
          </div>
        </body>
      </html>
    `);
  }
});

/**
 * Generate success page HTML
 */
function successPage(provider) {
  return `
    <html>
      <head><title>Connected!</title></head>
      <body style="font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0a0a0a; color: white;">
        <div style="text-align: center; padding: 2rem;">
          <div style="font-size: 48px; margin-bottom: 1rem;">✓</div>
          <h2>Connected to ${provider}!</h2>
          <p style="color: #999;">Your account is now linked. You can close this window.</p>
          <p style="margin-top: 2rem;"><a href="javascript:window.close()" style="color: #06b6d4;">Close this window</a></p>
        </div>
      </body>
    </html>
  `;
}

/**
 * Import media from connected account
 * POST /connections/:appId/import
 * 
 * Fetches media from the connected platform and creates Memory records
 */
router.post('/:appId/import', authRequired, async (req, res) => {
  const userId = req.user.id;
  const appId = req.params.appId;
  const { limit = 20 } = req.body;

  const connection = await prisma.connection.findUnique({ 
    where: { userId_appId: { userId, appId } } 
  });

  if (!connection || !connection.connected || !connection.token) {
    return res.status(400).json({ 
      error: 'not_connected', 
      message: `You need to connect your ${appId} account first` 
    });
  }

  try {
    let importedMemories = [];

    if (appId === 'facebook') {
      // Fetch photos from Facebook Graph API
      const photosRes = await fetch(
        `https://graph.facebook.com/v18.0/me/photos?fields=id,images,name,created_time,place&limit=${limit}&access_token=${connection.token}`
      );
      const photosData = await photosRes.json();
      
      if (photosData.error) {
        throw new Error(photosData.error.message);
      }

      for (const photo of (photosData.data || [])) {
        const imageUrl = photo.images?.[0]?.source;
        if (imageUrl) {
          const memory = await prisma.memory.create({
            data: {
              userId,
              type: 'photo',
              mediaUrl: imageUrl,
              caption: photo.name || 'Imported from Facebook',
              dateText: photo.created_time ? new Date(photo.created_time).toLocaleDateString() : null,
              location: photo.place?.name || null
            }
          });
          importedMemories.push(memory);
        }
      }
    }

    if (appId === 'instagram') {
      // Fetch media from Instagram Basic Display API
      const mediaRes = await fetch(
        `https://graph.instagram.com/me/media?fields=id,media_type,media_url,caption,timestamp,permalink&limit=${limit}&access_token=${connection.token}`
      );
      const mediaData = await mediaRes.json();
      
      if (mediaData.error) {
        throw new Error(mediaData.error.message);
      }

      for (const media of (mediaData.data || [])) {
        const memory = await prisma.memory.create({
          data: {
            userId,
            type: media.media_type === 'VIDEO' ? 'video' : 'photo',
            mediaUrl: media.media_url,
            caption: media.caption || 'Imported from Instagram',
            dateText: media.timestamp ? new Date(media.timestamp).toLocaleDateString() : null
          }
        });
        importedMemories.push(memory);
      }
    }

    if (appId === 'tiktok') {
      // Fetch videos from TikTok API
      const videosRes = await fetch(
        'https://open.tiktokapis.com/v2/video/list/',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${connection.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            max_count: limit,
            fields: ['id', 'title', 'video_description', 'create_time', 'cover_image_url', 'embed_link']
          })
        }
      );
      const videosData = await videosRes.json();
      
      if (videosData.error?.code) {
        throw new Error(videosData.error.message);
      }

      for (const video of (videosData.data?.videos || [])) {
        const memory = await prisma.memory.create({
          data: {
            userId,
            type: 'video',
            mediaUrl: video.cover_image_url || video.embed_link,
            caption: video.title || video.video_description || 'Imported from TikTok',
            dateText: video.create_time ? new Date(video.create_time * 1000).toLocaleDateString() : null
          }
        });
        importedMemories.push(memory);
      }
    }

    if (appId === 'photos') {
      // Fetch photos from Google Photos API
      const photosRes = await fetch(
        `https://photoslibrary.googleapis.com/v1/mediaItems?pageSize=${limit}`,
        {
          headers: {
            'Authorization': `Bearer ${connection.token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      const photosData = await photosRes.json();
      
      if (photosData.error) {
        throw new Error(photosData.error.message);
      }

      for (const item of (photosData.mediaItems || [])) {
        const memory = await prisma.memory.create({
          data: {
            userId,
            type: item.mimeType?.startsWith('video/') ? 'video' : 'photo',
            mediaUrl: `${item.baseUrl}=w800-h600`,
            caption: item.description || item.filename || 'Imported from Google Photos',
            dateText: item.mediaMetadata?.creationTime ? new Date(item.mediaMetadata.creationTime).toLocaleDateString() : null
          }
        });
        importedMemories.push(memory);
      }
    }

    res.json({ 
      success: true, 
      imported: importedMemories.length,
      memories: importedMemories 
    });
  } catch (err) {
    console.error(`Import error for ${appId}:`, err);
    res.status(500).json({ 
      error: 'import_failed', 
      message: err.message 
    });
  }
});

/**
 * Disconnect an app (revoke token and mark as disconnected)
 * DELETE /connections/:appId
 */
router.delete('/:appId', authRequired, async (req, res) => {
  const userId = req.user.id;
  const appId = req.params.appId;

  try {
    await prisma.connection.update({
      where: { userId_appId: { userId, appId } },
      data: { connected: false, token: null }
    });
    res.json({ success: true, appId, connected: false });
  } catch {
    res.status(404).json({ error: 'connection_not_found' });
  }
});

module.exports = router;