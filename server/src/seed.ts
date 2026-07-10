import bcrypt from 'bcryptjs';
import { prisma } from './prisma.js';

async function main() {
  console.log('Seeding database...');

  // Demo user with a session and some solves
  const demoHash = await bcrypt.hash('demo1234', 10);
  const demo = await prisma.user.upsert({
    where: { email: 'demo@speedcubing.central' },
    update: {},
    create: { email: 'demo@speedcubing.central', passwordHash: demoHash, displayName: 'Demo Cuber', role: 'USER' },
  });

  const existingSession = await prisma.session.findFirst({ where: { userId: demo.id } });
  if (!existingSession) {
    const session = await prisma.session.create({
      data: { userId: demo.id, eventId: '333', name: 'Main 3x3' },
    });
    const times = [12340, 11890, 13560, 10920, 14200, 12010, 11540];
    for (const t of times) {
      await prisma.solve.create({
        data: { sessionId: session.id, userId: demo.id, time: t, scramble: "R U R' U'", penalty: 'NONE' },
      });
    }
    console.log('  Demo session with sample solves created.');
  }

  console.log('Seed complete.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
