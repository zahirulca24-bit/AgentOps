import fs from 'node:fs/promises';
import path from 'node:path';
import { createApp } from './backend/dist/app/create-app.js';
import { loadConfig } from './backend/dist/config/env.js';

const config = loadConfig();
const app = await createApp(config);
const frontendDist = path.resolve('frontend/dist');
const indexFile = path.join(frontendDist, 'index.html');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

app.get('/*', async (request, reply) => {
  const routePath = String(request.params?.['*'] ?? '');
  if (routePath.startsWith('api/') || routePath === 'health' || routePath === 'ready') {
    return reply.callNotFound();
  }

  const filePath = path.resolve(frontendDist, routePath || 'index.html');
  if (filePath === frontendDist || filePath.startsWith(frontendDist + path.sep)) {
    try {
      const stat = await fs.stat(filePath);
      if (stat.isFile()) {
        reply.type(mime[path.extname(filePath).toLowerCase()] || 'application/octet-stream');
        return reply.send(await fs.readFile(filePath));
      }
    } catch {}
  }

  reply.type('text/html; charset=utf-8');
  return reply.send(await fs.readFile(indexFile));
});

await app.listen({ host: config.HOST, port: config.PORT });
