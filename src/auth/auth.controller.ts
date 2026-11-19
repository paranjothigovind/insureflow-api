import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import {
  AccessTokenDto,
  CurrentUserDto,
  RegisteredUserDto,
} from './dto/auth-responses.dto.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { CurrentUser } from './current-user.decorator.js';
import type { AuthenticatedUser } from './authenticated-user.interface.js';
import { BEARER_AUTH } from './auth.constants.js';

/** Credential endpoints allow only a handful of attempts per minute per client. */
const CREDENTIAL_THROTTLE = { default: { limit: 5, ttl: 60_000 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle(CREDENTIAL_THROTTLE)
  @ApiOperation({ summary: 'Register a new agent account' })
  @ApiCreatedResponse({ type: RegisteredUserDto })
  @ApiConflictResponse({ description: 'Email already registered.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  @Throttle(CREDENTIAL_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange credentials for an access token' })
  @ApiOkResponse({ type: AccessTokenDto })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password.' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded.' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth(BEARER_AUTH)
  @ApiOperation({ summary: 'Get the authenticated user' })
  @ApiOkResponse({ type: CurrentUserDto })
  @ApiUnauthorizedResponse({
    description: 'Missing, invalid or expired token.',
  })
  getProfile(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }
}
