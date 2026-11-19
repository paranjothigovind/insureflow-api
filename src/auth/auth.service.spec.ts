import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Prisma, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  let service: AuthService;

  const prisma = {
    user: { findUnique: vi.fn(), create: vi.fn() },
  };
  const jwtService = { signAsync: vi.fn() };

  // A low cost factor keeps the suite fast; production uses BCRYPT_SALT_ROUNDS.
  const passwordHash = bcrypt.hashSync('correct-password', 4);
  const storedUser = {
    id: 'user-1',
    email: 'agent@example.com',
    passwordHash,
    role: UserRole.AGENT,
    isActive: true,
  };

  beforeEach(async () => {
    vi.resetAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
  });

  describe('register', () => {
    const dto = {
      email: '  Agent@Example.com ',
      password: 'correct-password',
      fullName: ' Jane Agent ',
    };

    it('normalizes input, hashes the password and creates an AGENT', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(storedUser);

      const result = await service.register(dto);

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'agent@example.com' },
      });

      const { data } = prisma.user.create.mock.calls[0][0];
      expect(data.email).toBe('agent@example.com');
      expect(data.role).toBe(UserRole.AGENT);
      expect(data.agent).toEqual({ create: { fullName: 'Jane Agent' } });
      expect(data.passwordHash).not.toBe(dto.password);
      expect(await bcrypt.compare(dto.password, data.passwordHash)).toBe(true);

      // The hash must never be returned to the caller.
      expect(result).toEqual({
        id: 'user-1',
        email: 'agent@example.com',
        role: UserRole.AGENT,
      });
    });

    it('rejects an email that is already registered', async () => {
      prisma.user.findUnique.mockResolvedValue(storedUser);

      await expect(service.register(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('maps a unique-constraint race to a 409', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(service.register(dto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rethrows unexpected database errors', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockRejectedValue(new Error('db down'));

      await expect(service.register(dto)).rejects.toThrow('db down');
    });
  });

  describe('login', () => {
    const dto = { email: 'Agent@Example.com', password: 'correct-password' };

    it('returns a bearer token for valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue(storedUser);
      jwtService.signAsync.mockResolvedValue('signed.jwt.token');

      await expect(service.login(dto)).resolves.toEqual({
        accessToken: 'signed.jwt.token',
        tokenType: 'Bearer',
        expiresIn: 900,
      });
      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: 'user-1',
        email: 'agent@example.com',
        role: UserRole.AGENT,
      });
    });

    it.each([
      ['unknown email', null],
      ['deactivated account', { ...storedUser, isActive: false }],
      [
        'wrong password',
        { ...storedUser, passwordHash: bcrypt.hashSync('other', 4) },
      ],
    ])('rejects %s with the same generic error', async (_label, user) => {
      prisma.user.findUnique.mockResolvedValue(user);

      const attempt = service.login(dto);

      await expect(attempt).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(attempt).rejects.toThrow('Invalid email or password');
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });
  });
});
