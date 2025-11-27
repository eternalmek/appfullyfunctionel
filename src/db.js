// DB init + seeding (run on server start). Uses better-sqlite3 (synchronous).
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
require('dotenv').config();

const DB_FILE = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'db.sqlite');

function ensureDir(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

ensureDir(DB_FILE);

const db = new Database(DB_FILE);

const createTables = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  email TEXT UNIQUE,
  handle TEXT,
  avatar TEXT,
  password_hash TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  media TEXT,
  caption TEXT,
  date TEXT,
  location TEXT,
  duration TEXT,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS connections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  app_id TEXT NOT NULL,
  connected INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id, app_id)
);
`;

db.exec(createTables);

// Seed a default user and some memories if none exist
const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
if (userCount === 0) {
  const insertUser = db.prepare('INSERT INTO users (name, email, handle, avatar) VALUES (?, ?, ?, ?)');
  const info = insertUser.run(
    'Alex',
    'alex@example.com',
    '@alex_eternal',
    'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop'
  );
  const userId = info.lastInsertRowid;

  const insertMemory = db.prepare(`INSERT INTO memories 
    (user_id, type, media, caption, date, location, duration, likes, comments) 
    VALUES (@user_id, @type, @media, @caption, @date, @location, @duration, @likes, @comments)`);
  
  const initial = [
    {
      type: 'video', media: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&h=600&fit=crop',
      caption: 'The lights here never sleep. 🎌 #TravelDiaries', date: '2 hours ago', location: 'Kyoto, Japan', duration: null, likes: 234, comments: 12
    },
    {
      type: 'audio', media: null, caption: 'Midnight thoughts on the new project...', date: 'Yesterday', location: 'Voice Note', duration: '0:45', likes: 45, comments: 2
    },
    {
      type: 'photo', media: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800&h=800&fit=crop',
      caption: 'Sunday brunch crew. ☕️', date: 'Nov 14, 2023', location: 'Brooklyn, NY', duration: null, likes: 892, comments: 45
    }
  ];

  const insertMany = db.transaction((items) => {
    for (const it of items) {
      insertMemory.run({
        user_id: userId,
        type: it.type,
        media: it.media,
        caption: it.caption,
        date: it.date,
        location: it.location,
        duration: it.duration,
        likes: it.likes,
        comments: it.comments
      });
    }
  });

  insertMany(initial);

  // Seed connections defaults (all disconnected)
  const insertConn = db.prepare('INSERT OR IGNORE INTO connections (user_id, app_id, connected) VALUES (?, ?, ?)');
  ['instagram','facebook','tiktok','photos'].forEach(app => insertConn.run(userId, app, 0));

  console.log('Seeded DB with default user and memories.');
}

module.exports = db;