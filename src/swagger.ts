import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { BEARER_AUTH } from './auth/auth.constants.js';

/** URL path the interactive API docs are served from. */
export const SWAGGER_PATH = 'docs';

/** Mounts Swagger UI at `/docs` and the raw OpenAPI document at `/docs-json`. */
export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('InsureFlow API')
    .setDescription(
      'Backend for managing insurance agents, customers, policies and payments.',
    )
    .setVersion('0.0.1')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      BEARER_AUTH,
    )
    .build();

  SwaggerModule.setup(
    SWAGGER_PATH,
    app,
    SwaggerModule.createDocument(app, config),
    {
      // Keep the entered token when the page is refreshed.
      swaggerOptions: { persistAuthorization: true },
    },
  );
}
