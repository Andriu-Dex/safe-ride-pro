import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { selectOperationalMembership } from '@saferidepro/shared-types';
import { createHash } from 'node:crypto';

import { AuditService } from '../../../audit/application/services/audit.service';
import { AuditAction, AuditEntityType } from '../../../audit/domain/audit.types';
import {
  AUTH_USER_REPOSITORY,
  AuthUserRepository,
} from '../ports/auth-user.repository';
import { AuthSessionService } from '../services/auth-session.service';

@Injectable()
export class VerifyEmailUseCase {
  constructor(
    @Inject(AUTH_USER_REPOSITORY)
    private readonly authUserRepository: AuthUserRepository,
    private readonly auditService: AuditService,
    private readonly authSessionService: AuthSessionService,
  ) {}

  async execute(code: string): Promise<{
    message: string;
    accessToken: string;
    refreshToken: string;
  }> {
    const tokenHash = createHash('sha256').update(code.trim()).digest('hex');
    const verificationRecord = await this.authUserRepository.findValidEmailVerification(
      tokenHash,
      new Date(),
    );

    if (!verificationRecord) {
      throw new BadRequestException('El codigo de verificacion es invalido o ha expirado.');
    }

    const verifiedUser = await this.authUserRepository.markEmailAsVerified(
      verificationRecord.userId,
      verificationRecord.id,
      new Date(),
    );

    const defaultMembership = selectOperationalMembership(verifiedUser.memberships);

    await this.auditService.record({
      institutionId: defaultMembership?.institutionId,
      actorUserId: verifiedUser.id,
      action: AuditAction.AuthEmailVerified,
      entityType: AuditEntityType.User,
      entityId: verifiedUser.id,
      metadata: {
        email: verifiedUser.email,
      },
    });

    const issuedSession = await this.authSessionService.issueTokens(
      verifiedUser.id,
      verifiedUser.globalRole,
    );

    await this.authUserRepository.createRefreshTokenSession(
      verifiedUser.id,
      issuedSession.refreshTokenHash,
      issuedSession.refreshTokenExpiresAt,
    );

    return {
      message: 'Correo verificado correctamente.',
      accessToken: issuedSession.accessToken,
      refreshToken: issuedSession.refreshToken,
    };
  }
}
