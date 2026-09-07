import { FastifyInstance } from 'fastify';
import { DatabaseAgentService } from './database-agent.service.js';
import { executeQuerySchema, executeMigrationSchema } from './database-agent.schema.ts';

export async function databaseAgentRoutes(app: FastifyInstance) {
  const service = new DatabaseAgentService(app.db);

  // Inspect database schema metadata
  app.get('/api/v1/database/schema', async (_request, reply) => {
    const schemaList = await service.inspectSchema();
    return reply.send({
      success: true,
      count: schemaList.length,
      tables: schemaList,
    });
  });

  // Inspect specific table schema metadata
  app.get('/api/v1/database/schema/:tableName', async (request, reply) => {
    const { tableName } = request.params as { tableName: string };
    const tables = await service.inspectSchema(tableName);
    return reply.send({
      success: true,
      table: tables[0],
    });
  });

  // Execute SQL Query
  app.post('/api/v1/database/query', async (request, reply) => {
    const body = executeQuerySchema.parse(request.body);
    const actor = (request.headers['x-actor-id'] as string) || body.actor || 'system';
    const result = await service.executeQuery({
      ...body,
      actor,
    });
    return reply.send({
      success: true,
      queryResult: result,
    });
  });

  // Execute Schema Migration DDL (Red Tier — Requires Human Approval)
  app.post('/api/v1/database/migrate', async (request, reply) => {
    const body = executeMigrationSchema.parse(request.body);
    const result = await service.executeMigration(body);
    return reply.status(200).send({
      success: true,
      migration: result,
    });
  });

  // List past database query execution logs
  app.get('/api/v1/database/logs', async (_request, reply) => {
    const logs = await service.listQueryLogs();
    return reply.send({
      success: true,
      count: logs.length,
      logs,
    });
  });
}
