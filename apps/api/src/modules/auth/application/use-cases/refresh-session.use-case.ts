import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AccountStatus, selectOperationalMembership } from '@saferidepro/shared-types';

import { AuditService } from '../../../audit/application/services/audit.service';
import { AuditAction, AuditEntityType } from '../../../audit/domain/audit.types';
import {
  AUTH_USER_REPOSITORY,
  AuthUserRepository,
} from '../ports/auth-user.repository';
import {
  REFRESH_TOKEN_SERVICE,
  RefreshTokenService,
} from '../ports/refresh-token.service';
import { AuthSessionService } from '../services/auth-session.service';

export type RefreshSessionInput = {
  refreshToken: string;
};

@Injectable()
export class RefreshSessionUseCase {
  constructor(
    @Inject(AUTH_USER_REPOSITORY)
    private readonly authUserRepository: AuthUserRepository,
    @Inject(REFRESH_TOKEN_SERVICE)
    private readonly refreshTokenService: RefreshTokenService,
    private readonly authSessionService: AuthSessionService,
    private readonly auditService: AuditService,
  ) {}

  async execute(input: RefreshSessionInput): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const refreshTokenHash = this.refreshTokenService.hash(input.refreshToken.trim());
    const now = new Date();
    const refreshSession = await this.authUserRepository.findValidRefreshTokenSession(
      refreshTokenHash,
      now,
    );

    if (!refreshSession) {
      throw new UnauthorizedException('La sesion ya no es valida. Ingresa nuevamente.');
    }

    const user = await this.authUserRepository.findUserById(refreshSession.userId);

    if (!user) {
      await this.authUserRepository.revokeRefreshTokenSession(refreshSession.id, now);
      throw new UnauthorizedException('La sesion ya no es valida. Ingresa nuevamente.');
    }

    if (!user.emailVerifiedAt || user.accountStatus === AccountStatus.PendingEmailVerification) {
      throw new ForbiddenException('Debes verificar tu correo antes de continuar.');
    }

    if (user.accountStatus === AccountStatus.Suspended) {
      throw new ForbiddenException('Esta cuenta se encuentra suspendida.');
    }

    const nextSession = await this.authSessionService.issueTokens(user.id, user.globalRole);

    await this.authUserRepository.revokeRefreshTokenSession(refreshSession.id, now);
    await this.authUserRepository.createRefreshTokenSession(
      user.id,
      nextSession.refreshTokenHash,
      nextSession.refreshTokenExpiresAt,
    );

    const operationalMembership = selectOperationalMembership(user.memberships);

    await this.auditService.record({
      institutionId: operationalMembership?.institutionId,
      actorUserId: user.id,
      action: AuditAction.AuthSessionRefreshed,
      entityType: AuditEntityType.AuthSession,
      entityId: user.id,
      metadata: {
        email: user.email,
      },
    });

    return {
      accessToken: nextSession.accessToken,
      refreshToken: nextSession.refreshToken,
    };
  }
}
