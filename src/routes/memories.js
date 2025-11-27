const express = require('express');
const prisma = require('../prismaClient');
const { authRequired } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { getIO } = require('../socket');

const router = express.Router();

// GET /memories?limit=&page=&search=
router.get('/', async (req, res) => {
  const { page = 1, limit = 20, search } = req.query;
  const skip = (Number(page) - 1) * Number(limit);
  const where = search ? { OR: [{ caption: { contains: search, mode: 'insensitive' } }, { location: { contains: search, mode: 'insensitive' } }] } : {};
  const memories = await prisma.memory.findMany({
    where,
    include: { user: true },
    orderBy: { createdAt: 'desc' },
    skip,
    take: Number(limit)
  });
  res.json({ memories });
});

// GET single
router.get('/:id', async (req, res) => {
  const mem = await prisma.memory.findUnique({ where: { id: req.params.id }, include: { user: true } });
  if (!mem) return res.status(404).json({ error: 'not_found' });
  res.json({ memory: mem });
});

// Create memory
router.post('/',
  authRequired,
  body('type').notEmpty(),
  async (req, res) => {
    const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const userId = req.user.id;
    const { type, mediaUrl, caption, dateText, location, duration } = req.body;
    const mem = await prisma.memory.create({ data: { userId, type, mediaUrl, caption, dateText, location, duration } });
    const full = await prisma.memory.findUnique({ where: { id: mem.id }, include: { user: true } });
    res.status(201).json({ memory: full });
  }
);

// Edit memory (owner)
router.put('/:id', authRequired, async (req, res) => {
  const userId = req.user.id;
  const mem = await prisma.memory.findUnique({ where: { id: req.params.id } });
  if (!mem) return res.status(404).json({ error: 'not_found' });
  if (mem.userId !== userId) return res.status(403).json({ error: 'forbidden' });
  const updated = await prisma.memory.update({ where: { id: mem.id }, data: req.body });
  res.json({ memory: updated });
});

// Delete
router.delete('/:id', authRequired, async (req, res) => {
  const userId = req.user.id;
  const mem = await prisma.memory.findUnique({ where: { id: req.params.id } });
  if (!mem) return res.status(404).json({ error: 'not_found' });
  if (mem.userId !== userId) return res.status(403).json({ error: 'forbidden' });
  await prisma.memory.delete({ where: { id: mem.id } });
  res.json({ ok: true });
});

// Like
router.post('/:id/like', authRequired, async (req, res) => {
  const userId = req.user.id;
  const memId = req.params.id;
  try {
    await prisma.like.create({ data: { memoryId: memId, userId } });
    await prisma.memory.update({ where: { id: memId }, data: { likesCount: { increment: 1 } } });
    const io = getIO();
    io.to(`user:${userId}`).emit('memory:liked', { memoryId: memId, userId });
    res.json({ ok: true });
  } catch (err) {
    // unique constraint -> already liked
    res.status(400).json({ error: 'already_liked' });
  }
});

// Unlike (delete)
router.post('/:id/unlike', authRequired, async (req, res) => {
  const userId = req.user.id;
  const memId = req.params.id;
  const like = await prisma.like.findUnique({ where: { memoryId_userId: { memoryId: memId, userId } } });
  if (!like) return res.status(400).json({ error: 'not_liked' });
  await prisma.like.delete({ where: { id: like.id } });
  await prisma.memory.update({ where: { id: memId }, data: { likesCount: { decrement: 1 } } });
  res.json({ ok: true });
});

// Comments
router.get('/:id/comments', async (req, res) => {
  const comments = await prisma.comment.findMany({ where: { memoryId: req.params.id }, include: { user: true }, orderBy: { createdAt: 'asc' } });
  res.json({ comments });
});

router.post('/:id/comments', authRequired, body('text').notEmpty(), async (req, res) => {
  const errors = validationResult(req); if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  const userId = req.user.id;
  const memId = req.params.id;
  const comment = await prisma.comment.create({ data: { memoryId: memId, userId, text: req.body.text } });
  await prisma.memory.update({ where: { id: memId }, data: { commentsCount: { increment: 1 } } });
  const full = await prisma.comment.findUnique({ where: { id: comment.id }, include: { user: true } });
  const io = getIO();
  io.to(`user:${userId}`).emit('memory:comment', { memoryId: memId, comment: full });
  res.status(201).json({ comment: full });
});

module.exports = router;