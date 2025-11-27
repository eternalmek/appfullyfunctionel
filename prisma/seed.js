/**
 * Seed script to create initial database structure.
 * Run: npm run seed
 * 
 * Note: This script no longer creates fake memories.
 * Users should upload their own real data or connect their social media accounts.
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Initializing database...');
  
  // Create a demo user for testing purposes (optional)
  const email = 'demo@example.com';
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: 'Demo User',
        email,
        handle: 'demo_user',
        // No fake avatar - users should upload their own
      }
    });
    console.log('Created demo user:', user.email);
  } else {
    console.log('Demo user exists.');
  }

  // Initialize connection records for available apps (not connected by default)
  const apps = ['instagram', 'facebook', 'tiktok', 'photos'];
  for (const app of apps) {
    await prisma.connection.upsert({
      where: { userId_appId: { userId: user.id, appId: app } },
      update: {},
      create: { userId: user.id, appId: app, connected: false }
    });
  }
  console.log('Initialized connection records for apps:', apps.join(', '));

  // No fake memories created - users should:
  // 1. Connect their Instagram/Facebook/TikTok/Google Photos accounts
  // 2. Upload their own files directly
  console.log('\nSeed complete.');
  console.log('Note: No fake memories were created. Users should connect their accounts or upload their own data.');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });