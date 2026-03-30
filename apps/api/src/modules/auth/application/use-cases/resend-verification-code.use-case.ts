import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { generateEmailVerificationCode } from '@saferidepro/shared-types';
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

export type ResendVerificationCodeInput = {
  email: string;
};

export type ResendVerificationCodeOutput = {
  message: string;
  deliveryChannel?: AuthEmailDeliveryChannel;
  verificationCode?: string;
};

@Injectable()
export class ResendVerificationCodeUseCase {
  constructor(
    @Inject(AUTH_USER_REPOSITORY)
    private readonly authUserRepository: AuthUserRepository,
    @Inject(AUTH_EMAIL_SERVICE)
    private readonly authEmailService: AuthEmailService,
    private readonly environmentService: EnvironmentService,
    private readonly auditService: AuditService,
  ) {}

  async execute(input: ResendVerificationCodeInput): Promise<ResendVerificationCodeOutput> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const user = await this.authUserRepository.findUserByEmail(normalizedEmail);

    if (!user || user.emailVerifiedAt) {
      return {
        message: 'Si existe una cuenta pendiente, enviamos un nuevo codigo de verificacion.',
      };
    }

    const now = new Date();
    const latestCode = await this.authUserRepository.findLatestPendingEmailVerificationByUserId(
      user.id,
      now,
    );

    if (
      latestCode &&
      now.getTime() - latestCode.createdAt.getTime() <
        this.environmentService.authResendCooldownSeconds * 1000
    ) {
      throw new HttpException(
        'Espera un momento antes de solicitar un nuevo codigo.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const verificationCode = generateEmailVerificationCode();
    const verificationCodeHash = createHash('sha256')
      .update(verificationCode)
      .digest('hex');
    const expiresAt = new Date(
      Date.now() + this.environmentService.emailVerificationTokenTtlMinutes * 60 * 1000,
    );

    await this.authUserRepository.createEmailVerificationCode(
      user.id,
      verificationCodeHash,
      expiresAt,
    );

    const deliveryChannel = await this.authEmailService.sendVerificationCodeEmail({
      email: user.email,
      fullName: user.fullName,
      code: verificationCode,
      expiresInMinutes: this.environmentService.emailVerificationTokenTtlMinutes,
    });

    await this.auditService.record({
      institutionId: user.memberships.find((membership) => membership.isDefault)?.institutionId,
      actorUserId: user.id,
      action: AuditAction.AuthVerificationCodeResent,
      entityType: AuditEntityType.AuthSession,
      entityId: user.id,
      metadata: {
        email: user.email,
      },
    });

    return {
      message: 'Enviamos un nuevo codigo de verificacion a tu correo.',
      deliveryChannel,
      verificationCode: this.environmentService.authAllowDebugCodes
        ? verificationCode
        : undefined,
    };
  }
}
