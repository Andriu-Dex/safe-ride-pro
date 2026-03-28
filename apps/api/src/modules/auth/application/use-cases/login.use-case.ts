import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { AccountStatus } from '@saferidepro/shared-types';

import { AuditService } from '../../../audit/application/services/audit.service';
import { AuditAction, AuditEntityType } from '../../../audit/domain/audit.types';
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
    private readonly auditService: AuditService,
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
    const defaultMembership = user?.memberships.find((membership) => membership.isDefault)
      ?? user?.memberships[0];

    if (!user) {
      await this.auditService.record({
        action: AuditAction.AuthLoginFailed,
        entityType: AuditEntityType.AuthSession,
        metadata: {
          email: normalizedEmail,
          reason: 'INVALID_CREDENTIALS',
        },
      });
      throw new UnauthorizedException('Credenciales invalidas.');
    }

    const passwordMatches = await this.passwordHasher.compare(
      input.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      await this.auditService.record({
        institutionId: defaultMembership?.institutionId,
        actorUserId: user.id,
        action: AuditAction.AuthLoginFailed,
        entityType: AuditEntityType.AuthSession,
        metadata: {
          email: normalizedEmail,
          reason: 'INVALID_CREDENTIALS',
        },
      });
      throw new UnauthorizedException('Credenciales invalidas.');
    }

    if (!user.emailVerifiedAt || user.accountStatus === AccountStatus.PendingEmailVerification) {
      await this.auditService.record({
        institutionId: defaultMembership?.institutionId,
        actorUserId: user.id,
        action: AuditAction.AuthLoginFailed,
        entityType: AuditEntityType.AuthSession,
        metadata: {
          email: normalizedEmail,
          reason: 'EMAIL_NOT_VERIFIED',
        },
      });
      throw new ForbiddenException('Debes verificar tu correo antes de iniciar sesion.');
    }

    if (user.accountStatus === AccountStatus.Suspended) {
      await this.auditService.record({
        institutionId: defaultMembership?.institutionId,
        actorUserId: user.id,
        action: AuditAction.AuthLoginFailed,
        entityType: AuditEntityType.AuthSession,
        metadata: {
          email: normalizedEmail,
          reason: 'ACCOUNT_SUSPENDED',
        },
      });
      throw new ForbiddenException('Esta cuenta se encuentra suspendida.');
    }

    const accessToken = await this.accessTokenService.sign(user.id, user.globalRole);

    await this.auditService.record({
      institutionId: defaultMembership?.institutionId,
      actorUserId: user.id,
      action: AuditAction.AuthLoginSucceeded,
      entityType: AuditEntityType.AuthSession,
      entityId: user.id,
      metadata: {
        email: user.email,
      },
    });

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