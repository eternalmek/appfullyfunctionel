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

  // Enhanced fallback with comprehensive responses
  const lowerMessage = message.toLowerCase();
  const connectedCount = connections.filter(c => c.connected).length;
  const photoCount = memories.filter(m => m.type === 'photo').length;
  const videoCount = memories.filter(m => m.type === 'video').length;
  
  let reply = null;

  // Memory and app-specific responses
  if (lowerMessage.includes('connect') || lowerMessage.includes('instagram') || lowerMessage.includes('facebook') || lowerMessage.includes('tiktok') || lowerMessage.includes('google photos')) {
    if (connectedCount === 0) {
      reply = "Connecting your social media accounts is a great way to bring all your memories into one place! Head to 'The Core' section to securely link your Instagram, Facebook, TikTok, or Google Photos. Your data stays private and encrypted.";
    } else {
      reply = `You've already connected ${connectedCount} account(s). Would you like to connect more or start importing your memories from the connected ones?`;
    }
  } else if (lowerMessage.includes('upload') || lowerMessage.includes('import') || lowerMessage.includes('add memory') || lowerMessage.includes('add photo')) {
    reply = "You can upload your personal photos, videos, and audio files directly in 'The Core' section. Just drag and drop your files, and I'll help you organize them into your memory collection.";
  } else if (lowerMessage.includes('photo') || lowerMessage.includes('picture') || lowerMessage.includes('image')) {
    reply = photoCount > 0 
      ? `I found ${photoCount} photos in your collection! Would you like me to create a beautiful montage, or would you prefer to browse them by date or location?`
      : "I don't see any photos in your collection yet. You can upload some directly or connect your Instagram/Google Photos to import them automatically.";
  } else if (lowerMessage.includes('video')) {
    reply = videoCount > 0
      ? `You have ${videoCount} videos saved. I can help you create a highlight reel or organize them into themed collections.`
      : "No videos in your collection yet. Connect TikTok or upload your own videos to start preserving those moving memories!";
  } else if (lowerMessage.includes('montage') || lowerMessage.includes('compilation') || lowerMessage.includes('slideshow')) {
    reply = memories.length > 0
      ? `Great idea! I can create a beautiful montage from your ${memories.length} memories. Would you prefer a chronological journey, a themed compilation, or a highlight of your best moments?`
      : "To create a montage, we'll need some memories first. Would you like to connect your social accounts or upload some photos and videos?";
  } 
  // Greetings
  else if (lowerMessage.match(/^(hi|hello|hey|greetings|good morning|good afternoon|good evening|howdy)/)) {
    const greeting = lowerMessage.includes('morning') ? 'Good morning' : 
                     lowerMessage.includes('afternoon') ? 'Good afternoon' :
                     lowerMessage.includes('evening') ? 'Good evening' : 'Hello';
    reply = `${greeting}${user?.name ? `, ${user.name}` : ''}! 👋 I'm your personal memory companion. How can I help you today? I can help you organize your memories, connect social media accounts, or just chat about preserving your precious moments.`;
  }
  // About the assistant
  else if (lowerMessage.includes('who are you') || lowerMessage.includes('what are you') || lowerMessage.includes('your name')) {
    reply = "I'm The Mirror, your personal AI companion here at EternalMe! I'm designed to help you preserve, organize, and relive your precious memories. I can help you connect your social media accounts, create photo montages, and explore insights about your life journey. Think of me as your digital memory keeper! 🪞✨";
  }
  // What can you do
  else if (lowerMessage.includes('what can you do') || lowerMessage.includes('help me') || lowerMessage.includes('capabilities') || lowerMessage.match(/^help$/)) {
    reply = "I'm your personal memory companion! Here's what I can help you with:\n\n📱 **Connect Accounts** - Link your Instagram, Facebook, TikTok, or Google Photos\n📤 **Upload Memories** - Add your personal photos, videos, and audio files\n🎬 **Create Montages** - Build beautiful compilations of your memories\n📊 **View Insights** - Explore patterns and analytics about your collection\n🗂️ **Organize** - Sort memories by date, location, or theme\n💬 **Chat** - Ask me anything about managing your memories!\n\nWhat would you like to explore?";
  }
  // How to use / getting started
  else if (lowerMessage.includes('how to') || lowerMessage.includes('get started') || lowerMessage.includes('start') || lowerMessage.includes('begin') || lowerMessage.includes('tutorial')) {
    reply = "Great question! Here's how to get started with EternalMe:\n\n1️⃣ **Connect Your Accounts** - Go to 'The Core' section and link your social media\n2️⃣ **Import Memories** - Once connected, import your photos and videos\n3️⃣ **Upload Personal Files** - Drag and drop any files you want to preserve\n4️⃣ **Explore Your Timeline** - Browse your memories in the Feed section\n5️⃣ **Get Insights** - Check out the Analytics section to see patterns\n\nWould you like me to guide you through any of these steps?";
  }
  // Thank you
  else if (lowerMessage.includes('thank') || lowerMessage.includes('thanks') || lowerMessage.includes('appreciate')) {
    reply = "You're very welcome! 😊 I'm always here to help you preserve and celebrate your precious memories. Is there anything else you'd like to explore?";
  }
  // Goodbye
  else if (lowerMessage.includes('bye') || lowerMessage.includes('goodbye') || lowerMessage.includes('see you') || lowerMessage.includes('later')) {
    reply = `Take care${user?.name ? `, ${user.name}` : ''}! 👋 Your memories are safe here, and I'll be ready to help whenever you return. Have a wonderful day!`;
  }
  // How are you / feelings
  else if (lowerMessage.includes('how are you') || lowerMessage.includes('how do you feel') || lowerMessage.includes("how's it going")) {
    reply = "I'm doing great, thank you for asking! 😊 I'm here and ready to help you with your memories. Is there something specific you'd like to work on today?";
  }
  // Privacy and security
  else if (lowerMessage.includes('privacy') || lowerMessage.includes('secure') || lowerMessage.includes('safe') || lowerMessage.includes('data')) {
    reply = "Your privacy is our top priority! 🔒 All your data is encrypted end-to-end, and only you can see your memories. When you connect social media accounts, we only import what you authorize, and your credentials are never stored directly. You can disconnect any account at any time from 'The Core' section.";
  }
  // Memories summary
  else if (lowerMessage.includes('my memories') || lowerMessage.includes('collection') || lowerMessage.includes('summary') || lowerMessage.includes('statistics') || lowerMessage.includes('stats')) {
    if (memories.length > 0) {
      reply = `Here's a summary of your memory collection:\n\n📸 Photos: ${photoCount}\n🎥 Videos: ${videoCount}\n🎵 Audio: ${memories.filter(m => m.type === 'audio').length}\n📊 Total: ${memories.length} memories\n\nYour most recent memory: "${memories[0]?.caption || 'Untitled'}" ${memories[0]?.location ? `from ${memories[0].location}` : ''}\n\nWould you like to explore any of these, or add more memories?`;
    } else {
      reply = "Your memory collection is ready and waiting! 📦 You haven't added any memories yet, but that's easy to change. Would you like to connect your social media accounts or upload some files directly?";
    }
  }
  // Weather, time, general questions - be helpful but redirect
  else if (lowerMessage.includes('weather') || lowerMessage.includes('time') || lowerMessage.includes('date today')) {
    reply = "I specialize in helping you with your memories and the EternalMe app, so I don't have access to real-time information like weather or time. But I'm great at helping you preserve and organize your precious moments! Is there something memory-related I can help you with?";
  }
  // Questions about EternalMe
  else if (lowerMessage.includes('eternalme') || lowerMessage.includes('eternal me') || lowerMessage.includes('this app')) {
    reply = "EternalMe is your personal memory preservation platform! 🌟 It helps you:\n\n• Collect memories from all your social media in one place\n• Securely store photos, videos, and audio\n• Create beautiful montages and compilations\n• Explore patterns and insights about your life\n• Preserve your digital legacy\n\nAll your data is encrypted and private. Would you like help getting started?";
  }
  // Positive feedback
  else if (lowerMessage.includes('awesome') || lowerMessage.includes('great') || lowerMessage.includes('amazing') || lowerMessage.includes('love it') || lowerMessage.includes('cool')) {
    reply = "I'm so glad you're enjoying EternalMe! 🎉 Your memories deserve the best care. Is there anything specific you'd like to explore or create today?";
  }
  // Negative feedback or problems
  else if (lowerMessage.includes('problem') || lowerMessage.includes('issue') || lowerMessage.includes('not working') || lowerMessage.includes('broken') || lowerMessage.includes('error')) {
    reply = "I'm sorry to hear you're experiencing issues! 😔 Here are some things you can try:\n\n1. Refresh the page and try again\n2. Check your internet connection\n3. Make sure you're logged in\n4. For connection issues, try disconnecting and reconnecting the account\n\nIf the problem persists, please let me know what specific issue you're facing, and I'll do my best to help!";
  }
  // Default intelligent response
  else {
    // Check if it seems like a question
    const isQuestion = lowerMessage.includes('?') || 
                       lowerMessage.startsWith('what') || 
                       lowerMessage.startsWith('how') || 
                       lowerMessage.startsWith('why') || 
                       lowerMessage.startsWith('when') || 
                       lowerMessage.startsWith('where') || 
                       lowerMessage.startsWith('who') ||
                       lowerMessage.startsWith('can') ||
                       lowerMessage.startsWith('do') ||
                       lowerMessage.startsWith('is') ||
                       lowerMessage.startsWith('are');
    
    if (isQuestion) {
      reply = `That's a great question! While I'm specialized in helping with your memories and the EternalMe app, I'd love to assist you. Could you tell me more about what you're looking for? I can help you:\n\n• Connect social media accounts\n• Upload and organize memories\n• Create photo/video montages\n• Explore your memory insights\n• Navigate the app features\n\nWhat would you like to explore?`;
    } else if (memories.length > 0) {
      reply = `I'm here to help you with your memories! You currently have ${memories.length} memories in your collection. Your most recent one is "${memories[0]?.caption || 'untitled'}" ${memories[0]?.location ? `from ${memories[0].location}` : ''}. Would you like to explore your collection, create something new, or add more memories?`;
    } else {
      reply = "I'm here to help you preserve and explore your precious memories! 🌟 To get started, you can:\n\n• **Connect accounts** - Link your Instagram, Facebook, TikTok, or Google Photos in 'The Core' section\n• **Upload files** - Drag and drop your photos, videos, or audio\n• **Ask me anything** - I'm here to guide you!\n\nWhat would you like to do first?";
    }
  }

  res.json({ reply, provider: 'fallback', note: 'For full AI capabilities, configure OPENAI_API_KEY' });
});

module.exports = router;