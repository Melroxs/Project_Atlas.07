import 'dotenv/config';
import Fastify from 'fastify';
import fastifyPlugin from 'fastify-plugin';
import multipart from '@fastify/multipart';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { authMiddleware } from './middleware/auth';
import { roleMiddleware } from './middleware/role';
import { registerRoutes } from './routes';
import { validateEnv, env } from './lib/env';

export const buildFastify = () => {
  const server = Fastify({ logger: true });

  // Validate environment variables
  const envValidation = validateEnv();
  if (!envValidation.valid) {
    server.log.error('Environment validation failed:');
    envValidation.errors.forEach(error => server.log.error(`  - ${error}`));
    process.exit(1);
  }

  // Register CORS for security
  server.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
  });

  // Register rate limiting for security
  server.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Register multipart support for file uploads
  server.register(multipart);

  // Register auth middleware as a plugin (can be skipped per-route)
  server.register(fastifyPlugin(async (fastify) => {
    fastify.addHook('onRequest', async (request, reply) => {
      // Skip auth for health check and public routes
      if (request.url === '/health' || request.url.startsWith('/public')) {
        return;
      }
      await authMiddleware(request, reply);
    });
  }));
  
  // Register role middleware as a plugin (can be skipped per-route)
  server.register(fastifyPlugin(async (fastify) => {
    fastify.addHook('onRequest', async (request, reply) => {
      // Skip role check for health check and public routes
      if (request.url === '/health' || request.url.startsWith('/public')) {
        return;
      }
      await roleMiddleware(request, reply);
    });
  }));

  // Register all API routes under /api/v1
  server.register(registerRoutes, { prefix: '/api/v1' });

  // Health check
  server.get('/health', async (request, reply) => {
    return { status: 'ok' };
  });

  return server;
};

if (require.main === module) {
  const server = buildFastify();
  const start = async () => {
    try {
      await server.listen({ port: Number(env.PORT), host: '0.0.0.0' });
      server.log.info(`Server listening on ${server.server.address()?.toString()}`);
    } catch (err) {
      server.log.error(err);
      process.exit(1);
    }
  };

  start();
}
