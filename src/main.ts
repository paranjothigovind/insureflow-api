import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AppModule, ObserveInstrument } from './app.module.js';

const DEFAULT_PORT = 3000;

/** Parses `CORS_ORIGIN` (comma-separated) into a list of allowed origins. */
function parseAllowedOrigins(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    instrument: ObserveInstrument,
  });

  // Behind a reverse proxy (Render, a load balancer) the client IP arrives in
  // X-Forwarded-For. Trusting one hop makes rate limiting key on the real
  // client instead of the proxy.
  app.set('trust proxy', 1);

  // Secure HTTP headers (HSTS, no MIME sniffing, frame protection, ...).
  app.use(helmet());

  // CORS is closed by default; list the frontend origin(s) to open it up.
  const allowedOrigins = parseAllowedOrigins(process.env.CORS_ORIGIN);
  if (allowedOrigins.length > 0) {
    app.enableCors({ origin: allowedOrigins });
  }

  // Reject unknown fields and coerce payloads into their DTO types.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Lets Prisma disconnect cleanly on SIGTERM (e.g. `docker stop`).
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? DEFAULT_PORT);
}

await bootstrap();
