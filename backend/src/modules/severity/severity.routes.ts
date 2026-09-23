// Severity classification route
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { AppError } from '../../core/errors.js';
import { SeverityClassifierService } from './severity.service.js';
import type { EnvConfig } from '../../config/env.js';

// Reuse the input type from the service (duplicate schema for validation)
const classifyInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  category: z.string().optional().nullable(),
  affectedUrl: z.string().optional().nullable(),
  actualResult: z.string().optional().nullable(),
  expectedResult: z.string().optional().nullable(),
  // deterministic factor overrides (optional)
  userFlowImpact: z.enum(['blocking', 'degraded', 'minor', 'none']).optional(),
  securityImpact: z.enum(['high_risk', 'medium_risk', 'low_risk', 'none']).optional(),
  dataLossRisk: z.boolean().optional(),
  paymentAuthImpact: z.enum(['payment_failure', 'auth_failure', 'checkout_blocked', 'login_blocked', 'none']).optional(),
  reproducibility: z.enum(['always', 'frequent', 'intermittent', 'rare']).optional(),
  scopeOfUsers: z.enum(['all_users', 'many_users', 'some_users', 'isolated']).optional(),
});

export async function severityRoutes(fastify: FastifyInstance, options: { config: EnvConfig }) {
  const classifier = new SeverityClassifierService();

  // POST /api/v1/severity/classify
  fastify.post('/api/v1/severity/classify', async (request: FastifyRequest, reply: FastifyReply) => {
    const parseResult = classifyInputSchema.safeParse(request.body);
    if (!parseResult.success) {
      throw new AppError('VALIDATION_ERROR', 'Invalid classification payload', 400);
    }
    const classification = classifier.classify(parseResult.data);
    return reply.send({ data: classification });
  });
}
