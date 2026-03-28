import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';

import {
  AUTH_USER_REPOSITORY,
  AuthUserRepository,
} from '../ports/auth-user.repository';

@Injectable()
export class VerifyEmailUseCase {
  constructor(
    @Inject(AUTH_USER_REPOSITORY)
    private readonly authUserRepository: AuthUserRepository,
  ) {}

  async execute(token: string): Promise<{ message: string }> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const verificationRecord = await this.authUserRepository.findValidEmailVerification(
      tokenHash,
      new Date(),
    );

    if (!verificationRecord) {
      throw new BadRequestException('El token de verificacion es invalido o ha expirado.');
    }

    await this.authUserRepository.markEmailAsVerified(
      verificationRecord.userId,
      verificationRecord.id,
      new Date(),
    );

    return {
      message: 'Correo verificado correctamente.',
    };
  }
}
