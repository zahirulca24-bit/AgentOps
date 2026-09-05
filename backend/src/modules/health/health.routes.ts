import type { FastifyInstance } from 'fastify';
import type { Database } from '../../infrastructure/db/client.js';
import { sql } from 'drizzle-orm';

export async function healthRoutes(app: FastifyInstance, db: Database) {
  app.get('/health', async () => {
    return { status: 'ok' };
  });

  app.get('/ready', async (request, reply) => {
    try {
      await db.execute(sql`SELECT 1`);
      return { status: 'ready' };
    } catch (err) {
      request.log.error({ err }, 'Database readiness check failed');
      return reply.status(503).send({
        status: 'error',
        message: 'Service unavailable'
      });
    }
  });
}

