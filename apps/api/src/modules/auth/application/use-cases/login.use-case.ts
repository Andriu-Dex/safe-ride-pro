import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { AccountStatus } from '@saferidepro/shared-types';

import { ACCESS_TOKEN_SERVICE, AccessTokenService } from '../ports/access-token.service';
import {
  AUTH_USER_REPOSITORY,
  AuthUserRepository,
} from '../ports/auth-user.repository';
import { PASSWORD_HASHER, PasswordHasher } from '../ports/password-hasher';

export type LoginInput = {
  email: string;
  password: string;
};

@Injectable()
export class LoginUseCase {
  constructor(
    @Inject(AUTH_USER_REPOSITORY)
    private readonly authUserRepository: AuthUserRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasher,
    @Inject(ACCESS_TOKEN_SERVICE)
    private readonly accessTokenService: AccessTokenService,
  ) {}

  async execute(input: LoginInput): Promise<{
    accessToken: string;
    user: {
      id: string;
      email: string;
      fullName: string;
      globalRole: string;
      memberships: { id: string; institutionId: string; institutionName: string; role: string }[];
    };
  }> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const user = await this.authUserRepository.findUserByEmail(normalizedEmail);

    if (!user) {
      throw new UnauthorizedException('Credenciales invalidas.');
    }

    const passwordMatches = await this.passwordHasher.compare(
      input.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciales invalidas.');
    }

    if (!user.emailVerifiedAt || user.accountStatus === AccountStatus.PendingEmailVerification) {
      throw new ForbiddenException('Debes verificar tu correo antes de iniciar sesion.');
    }

    if (user.accountStatus === AccountStatus.Suspended) {
      throw new ForbiddenException('Esta cuenta se encuentra suspendida.');
    }

    const accessToken = await this.accessTokenService.sign(user.id, user.globalRole);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        globalRole: user.globalRole,
        memberships: user.memberships.map((membership) => ({
          id: membership.id,
          institutionId: membership.institutionId,
          institutionName: membership.institutionName,
          role: membership.role,
        })),
      },
    };
  }
}
