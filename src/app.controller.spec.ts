import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaService } from './prisma/prisma.service.js';

describe('AppController', () => {
  let appController: AppController;
  const prisma = { $queryRaw: vi.fn() };

  beforeEach(async () => {
    prisma.$queryRaw.mockReset();

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('identifies the service and reports it as running', () => {
      expect(appController.getStatus()).toEqual({
        service: 'InsureFlow API',
        status: 'ok',
        message: 'Welcome to the InsureFlow API. The service is running.',
      });
    });
  });

  describe('health', () => {
    it('reports liveness without touching the database', () => {
      expect(appController.getHealth()).toEqual({ status: 'ok' });
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('health/db', () => {
    it('reports connected when the database answers', async () => {
      prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      await expect(appController.checkDatabase()).resolves.toEqual({
        status: 'ok',
        database: 'connected',
      });
    });

    it('throws 503 when the database is unreachable', async () => {
      prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));
      // The service logs the underlying cause; keep it out of test output.
      vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      await expect(appController.checkDatabase()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });
  });
});
