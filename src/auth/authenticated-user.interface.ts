import type { UserRole } from '@prisma/client';

/** Shape of `request.user` once `JwtAuthGuard` has validated a token. */
export interface AuthenticatedUser {
  userId: string;
  email: string;
  role: UserRole;
}
