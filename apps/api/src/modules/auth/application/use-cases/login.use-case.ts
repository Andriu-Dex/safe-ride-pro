import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { AccountStatus, selectOperationalMembership } from '@saferidepro/shared-types';

import { AuditService } from '../../../audit/application/services/audit.service';
import { AuditAction, AuditEntityType } from '../../../audit/domain/audit.types';
import {
  AUTH_USER_REPOSITORY,
  AuthUserRepository,
} from '../ports/auth-user.repository';
import { PASSWORD_HASHER, PasswordHasher } from '../ports/password-hasher';
import { EnvironmentService } from '../../../../shared/infrastructure/config/environment.service';
import { AuthRateLimitService } from '../services/auth-rate-limit.service';
import { AuthSessionService } from '../services/auth-session.service';

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
    private readonly auditService: AuditService,
    private readonly authSessionService: AuthSessionService,
    private readonly authRateLimitService: AuthRateLimitService,
    private readonly environmentService: EnvironmentService,
  ) {}

  async execute(input: LoginInput): Promise<{
    accessToken: string;
    refreshToken: string;
    user: {
      id: string;
      email: string;
      fullName: string;
      globalRole: string;
      memberships: { id: string; institutionId: string; institutionName: string; role: string }[];
    };
  }> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const rateLimitKey = `login:${normalizedEmail}`;
    const rateLimitPolicy = {
      limit: this.environmentService.authFailedAttemptLimit,
      windowMs: this.environmentService.authFailedAttemptWindowMinutes * 60 * 1000,
    };

    this.authRateLimitService.assertAllowed(
      rateLimitKey,
      rateLimitPolicy,
      'Demasiados intentos fallidos. Intenta nuevamente en unos minutos.',
    );

    const user = await this.authUserRepository.findUserByEmail(normalizedEmail);
    const defaultMembership = selectOperationalMembership(user?.memberships);

    if (!user) {
      this.authRateLimitService.recordFailure(rateLimitKey, rateLimitPolicy);
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
      this.authRateLimitService.recordFailure(rateLimitKey, rateLimitPolicy);
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
      this.authRateLimitService.clear(rateLimitKey);
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
      this.authRateLimitService.clear(rateLimitKey);
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

    this.authRateLimitService.clear(rateLimitKey);

    const issuedSession = await this.authSessionService.issueTokens(user.id, user.globalRole);

    await this.authUserRepository.createRefreshTokenSession(
      user.id,
      issuedSession.refreshTokenHash,
      issuedSession.refreshTokenExpiresAt,
    );

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
      accessToken: issuedSession.accessToken,
      refreshToken: issuedSession.refreshToken,
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
