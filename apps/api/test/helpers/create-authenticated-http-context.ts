import type { Provider } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { CurrentUserContext } from '../../src/modules/auth/application/types/current-user-context.type';
import { JwtAuthGuard } from '../../src/modules/auth/presentation/guards/jwt-auth.guard';
import { PrismaService } from '../../src/shared/infrastructure/database/prisma.service';

type AuthenticatedHttpContext = {
  guardProviders: Provider[];
  applyAuthenticatedUser: (currentUser?: CurrentUserContext) => void;
};

export function createAuthenticatedHttpContext(
  initialUser: CurrentUserContext,
): AuthenticatedHttpContext {
  const jwtService = {
    verifyAsync: jest.fn(),
  };
  const prismaService = {
    user: {
      findUnique: jest.fn(),
    },
  };

  const applyAuthenticatedUser = (currentUser: CurrentUserContext = initialUser) => {
    jwtService.verifyAsync.mockResolvedValue({
      sub: currentUser.id,
    });
    prismaService.user.findUnique.mockResolvedValue({
      id: currentUser.id,
      email: currentUser.email,
      fullName: currentUser.fullName,
      globalRole: currentUser.globalRole,
      accountStatus: currentUser.accountStatus,
      memberships: currentUser.memberships.map((membership) => ({
        ...membership,
        joinedAt: new Date('2030-01-01T08:00:00.000Z'),
        institution: {
          name: membership.institutionName,
        },
      })),
    });
  };

  return {
    guardProviders: [
      JwtAuthGuard,
      {
        provide: JwtService,
        useValue: jwtService,
      },
      {
        provide: PrismaService,
        useValue: prismaService,
      },
    ],
    applyAuthenticatedUser,
  };
}
