import {
  BadRequestException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';

import { AuditService } from '../../../audit/application/services/audit.service';
import { AuditAction, AuditEntityType } from '../../../audit/domain/audit.types';
import {
  AUTH_USER_REPOSITORY,
  AuthUserRepository,
} from '../ports/auth-user.repository';
import { PASSWORD_HASHER, PasswordHasher } from '../ports/password-hasher';

export type ResetPasswordInput = {
  code: string;
  password: string;
};

@Injectable()
export class ResetPasswordUseCase {
  constructor(
    @Inject(AUTH_USER_REPOSITORY)
    private readonly authUserRepository: AuthUserRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasher,
    private readonly auditService: AuditService,
  ) {}

  async execute(input: ResetPasswordInput): Promise<{ message: string }> {
    const tokenHash = createHash('sha256').update(input.code.trim()).digest('hex');
    const now = new Date();
    const resetRecord = await this.authUserRepository.findValidPasswordResetCode(tokenHash, now);

    if (!resetRecord) {
      throw new BadRequestException('El codigo de recuperacion es invalido o ha expirado.');
    }

    const user = await this.authUserRepository.findUserById(resetRecord.userId);

    if (!user) {
      throw new BadRequestException('La cuenta asociada ya no existe.');
    }

    const passwordHash = await this.passwordHasher.hash(input.password);

    await this.authUserRepository.updatePassword(user.id, passwordHash);
    await this.authUserRepository.markPasswordResetCodeAsUsed(resetRecord.id, now);
    await this.authUserRepository.revokeAllRefreshTokenSessionsForUser(user.id, now);

    await this.auditService.record({
      institutionId: user.memberships.find((membership) => membership.isDefault)?.institutionId,
      actorUserId: user.id,
      action: AuditAction.AuthPasswordResetCompleted,
      entityType: AuditEntityType.User,
      entityId: user.id,
      metadata: {
        email: user.email,
      },
    });

    return {
      message: 'La contrasena se actualizo correctamente. Ya puedes iniciar sesion.',
    };
  }
}
