import { FastifyInstance } from 'fastify';
import { SecurityScannerService } from './security-scanner.service.js';
import { runSecurityScanSchema } from './security-scanner.schema.ts';

export async function securityScannerRoutes(app: FastifyInstance) {
  const service = new SecurityScannerService(app.db);

  // Run automated security scan
  app.post('/api/v1/security/scan', async (request, reply) => {
    const body = runSecurityScanSchema.parse(request.body);
    const result = await service.runScan(body);
    const statusCode = result.status === 'failed' ? 422 : 200;
    return reply.status(statusCode).send({
      success: result.status !== 'failed',
      scan: result,
    });
  });

  // List past security scan runs
  app.get('/api/v1/security/scans', async (_request, reply) => {
    const scans = await service.listScans();
    return reply.send({
      success: true,
      count: scans.length,
      scans,
    });
  });

  // Get specific security scan results
  app.get('/api/v1/security/scans/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const scan = await service.getScanResult(id);
    return reply.send({
      success: true,
      scan,
    });
  });
}
