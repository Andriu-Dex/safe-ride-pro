import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import { DocumentType } from '@saferidepro/shared-types';
import { createHash, randomBytes } from 'node:crypto';

import { EnvironmentService } from '../../../../shared/infrastructure/config/environment.service';
import {
  AUTH_USER_REPOSITORY,
  AuthUserRepository,
} from '../ports/auth-user.repository';
import { PASSWORD_HASHER, PasswordHasher } from '../ports/password-hasher';

export type RegisterUserInput = {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  documentType: DocumentType;
  documentNumber: string;
  studentCode: string;
};

export type RegisterUserOutput = {
  message: string;
  verificationToken: string;
  user: {
    id: string;
    email: string;
    fullName: string;
  };
};

@Injectable()
export class RegisterUserUseCase {
  constructor(
    @Inject(AUTH_USER_REPOSITORY)
    private readonly authUserRepository: AuthUserRepository,
    @Inject(PASSWORD_HASHER)
    private readonly passwordHasher: PasswordHasher,
    private readonly environmentService: EnvironmentService,
  ) {}

  async execute(input: RegisterUserInput): Promise<RegisterUserOutput> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const emailParts = normalizedEmail.split('@');
    const domain = emailParts.at(1)?.trim().toLowerCase();

    if (!domain) {
      throw new BadRequestException('A valid institutional email is required.');
    }

    const institution = await this.authUserRepository.findInstitutionByDomain(domain);

    if (!institution) {
      throw new BadRequestException('The email domain is not allowed for any active institution.');
    }

    const existingUser = await this.authUserRepository.findUserByEmail(normalizedEmail);

    if (existingUser) {
      throw new ConflictException('An account with this email already exists.');
    }

    const passwordHash = await this.passwordHasher.hash(input.password);

    const createdUser = await this.authUserRepository.createUserWithMembership({
      email: normalizedEmail,
      passwordHash,
      fullName: input.fullName.trim(),
      phone: input.phone?.trim() || undefined,
      documentType: input.documentType,
      documentNumber: input.documentNumber.trim(),
      studentCode: input.studentCode.trim(),
      institutionId: institution.id,
    });

    const verificationToken = randomBytes(24).toString('hex');
    const verificationTokenHash = createHash('sha256')
      .update(verificationToken)
      .digest('hex');
    const expiresAt = new Date(
      Date.now() + this.environmentService.emailVerificationTokenTtlMinutes * 60 * 1000,
    );

    await this.authUserRepository.createEmailVerificationCode(
      createdUser.id,
      verificationTokenHash,
      expiresAt,
    );

    return {
      message: 'Account created successfully. Verify your email to activate it.',
      verificationToken,
      user: {
        id: createdUser.id,
        email: createdUser.email,
        fullName: createdUser.fullName,
      },
    };
  }
}
