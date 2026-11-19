import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { AppService } from './app.service.js';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getStatus() {
    return this.appService.getStatus();
  }

  /** Liveness: the process is up. Deliberately does not touch the database. */
  @Get('health')
  @SkipThrottle()
  getHealth() {
    return this.appService.getHealth();
  }

  /** Readiness: the process can reach PostgreSQL. */
  @Get('health/db')
  @SkipThrottle()
  checkDatabase() {
    return this.appService.checkDatabase();
  }
}
