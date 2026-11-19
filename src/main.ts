import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule, ObserveInstrument } from './app.module.js';
import { SWAGGER_PATH, setupSwagger } from './swagger.js';

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
  // Swagger UI relies on inline scripts and styles, which helmet's default
  // Content-Security-Policy blocks, so that one header is relaxed for the docs
  // page only. Every other route keeps the full policy.
  const strictHelmet = helmet();
  const docsHelmet = helmet({ contentSecurityPolicy: false });
  app.use((req: Request, res: Response, next: NextFunction) =>
    req.path.startsWith(`/${SWAGGER_PATH}`)
      ? docsHelmet(req, res, next)
      : strictHelmet(req, res, next),
  );

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

  setupSwagger(app);

  // Lets Prisma disconnect cleanly on SIGTERM (e.g. `docker stop`).
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? DEFAULT_PORT);
}

await bootstrap();
