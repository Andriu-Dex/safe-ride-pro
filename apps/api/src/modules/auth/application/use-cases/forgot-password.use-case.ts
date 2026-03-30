import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { generatePasswordResetCode } from '@saferidepro/shared-types';
import { createHash } from 'node:crypto';

import { AuditService } from '../../../audit/application/services/audit.service';
import { AuditAction, AuditEntityType } from '../../../audit/domain/audit.types';
import { EnvironmentService } from '../../../../shared/infrastructure/config/environment.service';
import {
  AUTH_EMAIL_SERVICE,
  AuthEmailDeliveryChannel,
  AuthEmailService,
} from '../ports/auth-email.service';
import {
  AUTH_USER_REPOSITORY,
  AuthUserRepository,
} from '../ports/auth-user.repository';

export type ForgotPasswordInput = {
  email: string;
};

export type ForgotPasswordOutput = {
  message: string;
  deliveryChannel?: AuthEmailDeliveryChannel;
  resetCode?: string;
};

@Injectable()
export class ForgotPasswordUseCase {
  constructor(
    @Inject(AUTH_USER_REPOSITORY)
    private readonly authUserRepository: AuthUserRepository,
    @Inject(AUTH_EMAIL_SERVICE)
    private readonly authEmailService: AuthEmailService,
    private readonly environmentService: EnvironmentService,
    private readonly auditService: AuditService,
  ) {}

  async execute(input: ForgotPasswordInput): Promise<ForgotPasswordOutput> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const user = await this.authUserRepository.findUserByEmail(normalizedEmail);

    if (!user || !user.emailVerifiedAt) {
      return {
        message:
          'Si existe una cuenta activa con ese correo, enviamos instrucciones para restablecer la contrasena.',
      };
    }

    const now = new Date();
    const latestReset = await this.authUserRepository.findLatestPendingPasswordResetByUserId(
      user.id,
      now,
    );

    if (
      latestReset &&
      now.getTime() - latestReset.createdAt.getTime() <
        this.environmentService.authResendCooldownSeconds * 1000
    ) {
      throw new HttpException(
        'Espera un momento antes de solicitar un nuevo codigo de recuperacion.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const resetCode = generatePasswordResetCode();
    const resetCodeHash = createHash('sha256').update(resetCode).digest('hex');
    const expiresAt = new Date(
      Date.now() + this.environmentService.passwordResetTokenTtlMinutes * 60 * 1000,
    );

    await this.authUserRepository.createPasswordResetCode(user.id, resetCodeHash, expiresAt);

    const deliveryChannel = await this.authEmailService.sendPasswordResetCodeEmail({
      email: user.email,
      fullName: user.fullName,
      code: resetCode,
      expiresInMinutes: this.environmentService.passwordResetTokenTtlMinutes,
    });

    await this.auditService.record({
      institutionId: user.memberships.find((membership) => membership.isDefault)?.institutionId,
      actorUserId: user.id,
      action: AuditAction.AuthPasswordResetRequested,
      entityType: AuditEntityType.User,
      entityId: user.id,
      metadata: {
        email: user.email,
      },
    });

    return {
      message:
        'Si existe una cuenta activa con ese correo, enviamos instrucciones para restablecer la contrasena.',
      deliveryChannel,
      resetCode: this.environmentService.authAllowDebugCodes ? resetCode : undefined,
    };
  }
}
