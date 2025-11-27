const express = require('express');
const multer = require('multer');
const { uploadBuffer } = require('../utils/s3');
const prisma = require('../prismaClient');
const { authRequired } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.post('/', authRequired, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file_required' });
  const { originalname, buffer, mimetype } = req.file;
  const ext = originalname.split('.').pop();
  const key = `memories/${uuidv4()}.${ext}`;
  try {
    const location = await uploadBuffer(buffer, key, mimetype);
    const { type = 'photo', caption, dateText, location: loc } = req.body;
    const memory = await prisma.memory.create({
      data: {
        userId: req.user.id,
        type,
        mediaUrl: location,
        caption,
        dateText,
        location: loc
      },
      include: { user: true }
    });
    res.status(201).json({ memory });
  } catch (err) {
    console.error('S3 upload error', err);
    res.status(500).json({ error: 'upload_failed' });
  }
});

module.exports = router;