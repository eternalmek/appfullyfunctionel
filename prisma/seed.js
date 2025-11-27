/**
 * Seed script to create a demo user and some memories.
 * Run: npm run seed
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = 'alex@example.com';
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: 'Alex',
        email,
        handle: '@alex_eternal',
        avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&h=150&fit=crop'
      }
    });
    console.log('Created demo user:', user.email);
  } else {
    console.log('Demo user exists.');
  }

  const existing = await prisma.memory.count({ where: { userId: user.id } });
  if (existing === 0) {
    await prisma.memory.createMany({
      data: [
        {
          userId: user.id,
          type: 'video',
          mediaUrl: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&h=600&fit=crop',
          caption: 'The lights here never sleep. 🎌 #TravelDiaries',
          dateText: '2 hours ago',
          location: 'Kyoto, Japan',
          likesCount: 234,
          commentsCount: 12
        },
        {
          userId: user.id,
          type: 'audio',
          caption: 'Midnight thoughts on the new project...',
          dateText: 'Yesterday',
          location: 'Voice Note',
          duration: '0:45',
          likesCount: 45,
          commentsCount: 2
        },
        {
          userId: user.id,
          type: 'photo',
          mediaUrl: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?w=800&h=800&fit=crop',
          caption: 'Sunday brunch crew. ☕️',
          dateText: 'Nov 14, 2023',
          location: 'Brooklyn, NY',
          likesCount: 892,
          commentsCount: 45
        }
      ]
    });
    console.log('Seeded memories.');
  } else {
    console.log('Memories already present.');
  }

  // Seed default connections
  const apps = ['instagram', 'facebook', 'tiktok', 'photos'];
  for (const app of apps) {
    await prisma.connection.upsert({
      where: { userId_appId: { userId: user.id, appId: app } },
      update: {},
      create: { userId: user.id, appId: app, connected: false }
    });
  }

  console.log('Seed complete.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });