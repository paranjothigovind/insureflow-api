import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from './dto/register.dto.js';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import { LoginDto } from './dto/login.dto.js';

@Injectable()
export class AuthService {
    constructor(private readonly prisma: PrismaService, private readonly jwtService: JwtService) {}

    async register(dto: RegisterDto) {
        const email = dto.email.trim().toLowerCase();

        const existing = await this.prisma.user.findUnique({
            where: {
                email
            }
        })

        if(existing) {
            throw new ConflictException("Email already registered")
        }

        const passwordHash = await bcrypt.hash(dto.password, 12);

        const user = await this.prisma.user.create({
           data: {
            email,
            passwordHash,
            role: UserRole.AGENT,
            agent: {
                create: {
                    fullName: dto.fullName.trim()
                }
            }
           }

        })

        return {
            id: user.id,
            email: user.email,
            role: user.role
        }
    }

    async login(dto: LoginDto) {
        const email = dto.email.trim().toLowerCase();

        const user = await this.prisma.user.findUnique({
          where: { email },
        });

        if (
            !user ||
            !user.isActive ||
            !(await bcrypt.compare(dto.password, user.passwordHash))
        ) {
            throw new UnauthorizedException("invalid Email or password")
        }

        const accessToken = await this.jwtService.signAsync({
            sub: user.id,
            email: user.email,
            role: user.role
        })

        return {
            accessToken,
            tokenType: 'Bearer',
            expiresIn: 900,
        };
        
    }
}

