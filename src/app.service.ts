import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service.js';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private readonly prisma: PrismaService) {}

  getStatus() {
    return {
      service: 'InsureFlow API',
      status: 'ok',
      message: 'Welcome to the InsureFlow API. The service is running.',
    };
  }

  getHealth() {
    return { status: 'ok' };
  }

  async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok', database: 'connected' };
    } catch (error) {
      // Keep the cause in the logs, but don't leak it to the client.
      this.logger.error('Database health check failed', error);
      throw new ServiceUnavailableException('Database unavailable');
    }
  }
}
