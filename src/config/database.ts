import { PrismaClient } from '@prisma/client';
import { PrismaAccelerate } from '@prisma/adapter-accelerate';
import { config } from './env';
import { logger } from './logger';

// Create Prisma Client with Accelerate adapter
const accelerate = new PrismaAccelerate({
  url: config.prismaAccelerateUrl || config.databaseUrl,
});

export const prisma = new PrismaClient({
  adapter: config.prismaAccelerateUrl ? accelerate : undefined,
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'stdout' },
    { level: 'warn', emit: 'stdout' },
  ],
});

// Log queries in development
if (config.nodeEnv === 'development') {
  prisma.$on('query' as never, (e: { query: string; params: string; duration: number }) => {
    logger.debug('Query', { query: e.query, params: e.params, duration: `${e.duration}ms` });
  });
}

// Handle graceful shutdown
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

export default prisma;
