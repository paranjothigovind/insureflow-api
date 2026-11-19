import { Controller, Get } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { AppService } from './app.service.js';

@ApiTags('system')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Service banner' })
  @ApiOkResponse({
    schema: {
      example: {
        service: 'InsureFlow API',
        status: 'ok',
        message: 'Welcome to the InsureFlow API. The service is running.',
      },
    },
  })
  getStatus() {
    return this.appService.getStatus();
  }

  /** Liveness: the process is up. Deliberately does not touch the database. */
  @Get('health')
  @SkipThrottle()
  @ApiOperation({ summary: 'Liveness check (does not touch the database)' })
  @ApiOkResponse({ schema: { example: { status: 'ok' } } })
  getHealth() {
    return this.appService.getHealth();
  }

  /** Readiness: the process can reach PostgreSQL. */
  @Get('health/db')
  @SkipThrottle()
  @ApiOperation({ summary: 'Readiness check (queries PostgreSQL)' })
  @ApiOkResponse({
    schema: { example: { status: 'ok', database: 'connected' } },
  })
  @ApiServiceUnavailableResponse({ description: 'Database unavailable.' })
  checkDatabase() {
    return this.appService.checkDatabase();
  }
}
