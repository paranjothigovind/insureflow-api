import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';

/** Response schemas used only to document the API in Swagger. */

export class RegisteredUserDto {
  @ApiProperty({ example: '3f6c1c52-8d0e-4c0a-9d58-2f2f3c1a9b11' })
  id: string;

  @ApiProperty({ example: 'jane@example.com' })
  email: string;

  @ApiProperty({ enum: UserRole, example: UserRole.AGENT })
  role: UserRole;
}

export class AccessTokenDto {
  @ApiProperty({ description: 'Signed JWT to send as a Bearer token.' })
  accessToken: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType: string;

  @ApiProperty({ example: 900, description: 'Token lifetime in seconds.' })
  expiresIn: number;
}

export class CurrentUserDto {
  @ApiProperty({ example: '3f6c1c52-8d0e-4c0a-9d58-2f2f3c1a9b11' })
  userId: string;

  @ApiProperty({ example: 'jane@example.com' })
  email: string;

  @ApiProperty({ enum: UserRole, example: UserRole.AGENT })
  role: UserRole;
}
