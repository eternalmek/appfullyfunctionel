const express = require('express');
const OpenAI = require('openai');
const prisma = require('../prismaClient');
const { authRequired } = require('../middleware/auth');
require('dotenv').config();

const router = express.Router();

const OPENAI_KEY = process.env.OPENAI_API_KEY;
let openai = null;
let openaiInitError = null;

if (OPENAI_KEY) {
  try {
    openai = new OpenAI({ apiKey: OPENAI_KEY });
  } catch (err) {
    openaiInitError = err.message;
    console.error('Failed to initialize OpenAI client:', err.message);
  }
} else {
  console.warn('OpenAI API key not configured. AI responses will use fallback mode.');
}

/**
 * Build a compassionate AI assistant system prompt based on user's data
 */
function buildSystemPrompt(user, memories, connections) {
  const connectedApps = connections
    .filter(c => c.connected)
    .map(c => c.appId)
    .join(', ');
  
  const memoryStats = {
    total: memories.length,
    photos: memories.filter(m => m.type === 'photo').length,
    videos: memories.filter(m => m.type === 'video').length,
    audio: memories.filter(m => m.type === 'audio').length,
  };

  return `You are "The Mirror", a compassionate AI companion for the EternalMe app - a personal memory preservation and social media integration platform.

Your role is to be a warm, understanding assistant who helps users:
- Preserve and cherish their memories (photos, videos, voice notes)
- Connect and import content from their social media accounts (Instagram, Facebook, TikTok, Google Photos)
- Organize and relive meaningful moments from their life
- Create montages and compilations of their precious memories
- Understand patterns in their life journey through their digital footprint

Current User Context:
- Name: ${user?.name || 'User'}
- Connected Apps: ${connectedApps || 'None connected yet'}
- Memory Collection: ${memoryStats.total} items (${memoryStats.photos} photos, ${memoryStats.videos} videos, ${memoryStats.audio} audio notes)

Personality Guidelines:
- Be empathetic and supportive when discussing personal memories
- Celebrate their life moments and milestones
- Offer practical suggestions for organizing and preserving memories
- Be encouraging about connecting social media accounts to import their digital history
- Respect privacy and be sensitive when discussing personal content
- Use warm, conversational language without being overly formal

Available Actions You Can Suggest:
- Connect social media accounts (Instagram, Facebook, TikTok, Google Photos)
- Upload personal files (photos, videos, audio)
- Create memory montages or compilations
- Search through memories by date, location, or content
- View analytics and insights about their memory collection
- Organize memories into albums or timelines`;
}

/**
 * POST /mirror/message
 * body: { message }
 * Returns LLM reply that can use user's recent memories for context.
 */
router.post('/message', authRequired, async (req, res) => {
  const userId = req.user.id;
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'message_required' });

  // Fetch user info
  const user = await prisma.user.findUnique({ where: { id: userId } });

  // Fetch the most recent memories for context
  const memories = await prisma.memory.findMany({ 
    where: { userId }, 
    orderBy: { createdAt: 'desc' }, 
    take: 10 
  });

  // Fetch user's connections
  const connections = await prisma.connection.findMany({ where: { userId } });

  // Build context-aware prompts
  const systemPrompt = buildSystemPrompt(user, memories, connections);
  
  const memorySummary = memories.length > 0 
    ? memories.map(m => `- [${m.type}] "${m.caption || 'No caption'}" from ${m.location || 'unknown location'} (${m.dateText || 'unknown date'})`).join('\n')
    : 'No memories saved yet. This is a new user who might need help getting started.';

  const userPrompt = `User says: "${message}"

Recent memories in their collection:
${memorySummary}

Please respond with warmth and provide helpful guidance based on their message and context. If they're asking about connecting accounts or importing data, be encouraging and explain the benefits.`;

  if (openai) {
    try {
      const response = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 500,
        temperature: 0.7
      });
      const reply = response.choices?.[0]?.message?.content || "I'm here to help you with your memories. What would you like to explore?";
      return res.json({ reply, provider: 'openai' });
    } catch (err) {
      console.error('OpenAI error:', err.message || err);
      // fallback to rule-based below
    }
  }

  // Enhanced fallback deterministic reply with compassionate tone
  const lowerMessage = message.toLowerCase();
  let reply = "I'm here to help you preserve and explore your precious memories. You can connect your social media accounts to import your photos and videos, or upload files directly. What would you like to do?";

  if (lowerMessage.includes('connect') || lowerMessage.includes('instagram') || lowerMessage.includes('facebook') || lowerMessage.includes('tiktok')) {
    const connectedCount = connections.filter(c => c.connected).length;
    if (connectedCount === 0) {
      reply = "Connecting your social media accounts is a great way to bring all your memories into one place! Head to 'The Core' section to securely link your Instagram, Facebook, TikTok, or Google Photos. Your data stays private and encrypted.";
    } else {
      reply = `You've already connected ${connectedCount} account(s). Would you like to connect more or start importing your memories from the connected ones?`;
    }
  } else if (lowerMessage.includes('upload') || lowerMessage.includes('import') || lowerMessage.includes('add')) {
    reply = "You can upload your personal photos, videos, and audio files directly in 'The Core' section. Just drag and drop your files, and I'll help you organize them into your memory collection.";
  } else if (lowerMessage.includes('photo') || lowerMessage.includes('picture') || lowerMessage.includes('image')) {
    const photoCount = memories.filter(m => m.type === 'photo').length;
    reply = photoCount > 0 
      ? `I found ${photoCount} photos in your collection! Would you like me to create a beautiful montage, or would you prefer to browse them by date or location?`
      : "I don't see any photos in your collection yet. You can upload some directly or connect your Instagram/Google Photos to import them automatically.";
  } else if (lowerMessage.includes('video')) {
    const videoCount = memories.filter(m => m.type === 'video').length;
    reply = videoCount > 0
      ? `You have ${videoCount} videos saved. I can help you create a highlight reel or organize them into themed collections.`
      : "No videos in your collection yet. Connect TikTok or upload your own videos to start preserving those moving memories!";
  } else if (lowerMessage.includes('montage') || lowerMessage.includes('compilation') || lowerMessage.includes('create')) {
    reply = memories.length > 0
      ? `Great idea! I can create a beautiful montage from your ${memories.length} memories. Would you prefer a chronological journey, a themed compilation, or a highlight of your best moments?`
      : "To create a montage, we'll need some memories first. Would you like to connect your social accounts or upload some photos and videos?";
  } else if (lowerMessage.includes('help') || lowerMessage.includes('start') || lowerMessage.includes('how')) {
    reply = "I'm your personal memory companion! Here's what I can help you with:\n\n• Connect your Instagram, Facebook, TikTok, or Google Photos to import your memories\n• Upload personal files directly\n• Create beautiful montages and compilations\n• Organize memories by date, location, or theme\n• Explore insights about your life journey\n\nWhat sounds interesting to you?";
  } else if (memories.length > 0) {
    reply = `I've been looking through your ${memories.length} memories. Your most recent one is "${memories[0]?.caption || 'untitled'}" from ${memories[0]?.location || 'an unknown place'}. Would you like to explore more, create something with them, or add new memories?`;
  }

  res.json({ reply, provider: 'fallback' });
});

module.exports = router;