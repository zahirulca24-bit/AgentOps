import { createApp } from './app/create-app.js';
import { loadConfig } from './config/env.js';

async function start() {
  try {
    const config = loadConfig();
    const app = await createApp(config);
    
    await app.listen({ host: config.HOST, port: config.PORT });
    app.log.info(`AgentOps backend foundation ready. Server listening at http://${config.HOST}:${config.PORT}`);

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      app.log.info(`Received ${signal}. Shutting down gracefully...`);
      await app.close();
      process.exit(0);
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
}

start();
