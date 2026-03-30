import { Inject, Injectable } from '@nestjs/common';
import { selectOperationalMembership } from '@saferidepro/shared-types';

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

export type LogoutInput = {
  refreshToken: string;
};

@Injectable()
export class LogoutUseCase {
  constructor(
    @Inject(AUTH_USER_REPOSITORY)
    private readonly authUserRepository: AuthUserRepository,
    @Inject(REFRESH_TOKEN_SERVICE)
    private readonly refreshTokenService: RefreshTokenService,
    private readonly auditService: AuditService,
  ) {}

  async execute(input: LogoutInput): Promise<{ message: string }> {
    const tokenHash = this.refreshTokenService.hash(input.refreshToken.trim());
    const now = new Date();
    const refreshSession = await this.authUserRepository.findValidRefreshTokenSession(
      tokenHash,
      now,
    );

    if (!refreshSession) {
      return {
        message: 'La sesion se cerro correctamente.',
      };
    }

    await this.authUserRepository.revokeRefreshTokenSession(refreshSession.id, now);

    const user = await this.authUserRepository.findUserById(refreshSession.userId);

    if (user) {
      const operationalMembership = selectOperationalMembership(user.memberships);

      await this.auditService.record({
        institutionId: operationalMembership?.institutionId,
        actorUserId: user.id,
        action: AuditAction.AuthLoggedOut,
        entityType: AuditEntityType.AuthSession,
        entityId: user.id,
        metadata: {
          email: user.email,
        },
      });
    }

    return {
      message: 'La sesion se cerro correctamente.',
    };
  }
}
