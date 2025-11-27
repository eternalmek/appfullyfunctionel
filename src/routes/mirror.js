const express = require('express');
const { Configuration, OpenAIApi } = require('openai');
const prisma = require('../prismaClient');
const { authRequired } = require('../middleware/auth');
require('dotenv').config();

const router = express.Router();

const OPENAI_KEY = process.env.OPENAI_API_KEY;
let openai = null;
if (OPENAI_KEY) {
  const configuration = new Configuration({ apiKey: OPENAI_KEY });
  openai = new OpenAIApi(configuration);
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

  // Fetch the most recent memories for context (limit 5)
  const memories = await prisma.memory.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: 5 });

  // Build prompt
  const memorySummary = memories.map(m => `- [${m.type}] ${m.caption || ''} (${m.dateText || 'unknown'})`).join('\n');
  const system = `You are "The Mirror", a helpful assistant providing context-aware summaries of a user's memories. Use the provided recent memory list to respond concisely.`;
  const userPrompt = `User message: ${message}\n\nRecent memories:\n${memorySummary}\n\nRespond in a friendly, helpful tone and offer next actions (e.g., create montage, list items).`;

  if (openai) {
    try {
      const response = await openai.createChatCompletion({
        model: 'gpt-4o-mini', // change to available model in your account, fallback handled below
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 400
      });
      const reply = response.data.choices?.[0]?.message?.content || "I couldn't generate a reply.";
      return res.json({ reply, provider: 'openai' });
    } catch (err) {
      console.error('OpenAI error', err.message || err);
      // fallback to rule-based below
    }
  }

  // Fallback deterministic reply
  const containsPhoto = message.toLowerCase().includes('photo') || message.toLowerCase().includes('picture');
  let reply = "I found some related memories. Ask me to create a montage or list them.";
  if (containsPhoto && memories.length > 0) {
    reply = `I found ${memories.length} media items related to that. I can create a montage or list them.`;
  } else if (message.toLowerCase().includes('montage')) {
    reply = "I can create a montage from your selected photos and videos. Choose quality: low/medium/high.";
  }
  res.json({ reply, provider: 'fallback' });
});

module.exports = router;