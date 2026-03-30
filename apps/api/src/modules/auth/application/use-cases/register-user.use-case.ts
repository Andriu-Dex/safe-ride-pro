import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import {
  DocumentType,
  EMAIL_VERIFICATION_CODE_LENGTH,
  isValidEcuadorianNationalId,
} from '@saferidepro/shared-types';
import { createHash, randomInt } from 'node:crypto';

import { AuditService } from '../../../audit/application/services/audit.service';
import { AuditAction, AuditEntityType } from '../../../audit/domain/audit.types';
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
  studentCode?: string;
};

export type RegisterUserOutput = {
  message: string;
  verificationCode: string;
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
    private readonly auditService: AuditService,
  ) {}

  async execute(input: RegisterUserInput): Promise<RegisterUserOutput> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const emailParts = normalizedEmail.split('@');
    const domain = emailParts.at(1)?.trim().toLowerCase();

    if (!domain) {
      throw new BadRequestException('Se requiere un correo institucional valido.');
    }

    const institution = await this.authUserRepository.findInstitutionByDomain(domain);

    if (!institution) {
      throw new BadRequestException('El dominio del correo no esta permitido para ninguna institucion activa.');
    }

    const existingUser = await this.authUserRepository.findUserByEmail(normalizedEmail);

    if (existingUser) {
      throw new ConflictException('Ya existe una cuenta registrada con este correo.');
    }

    const normalizedDocumentNumber = input.documentNumber.trim();

    if (
      input.documentType === DocumentType.NationalId &&
      !isValidEcuadorianNationalId(normalizedDocumentNumber)
    ) {
      throw new BadRequestException('La cedula ecuatoriana no es valida.');
    }

    const passwordHash = await this.passwordHasher.hash(input.password);

    const createdUser = await this.authUserRepository.createUserWithMembership({
      email: normalizedEmail,
      passwordHash,
      fullName: input.fullName.trim(),
      phone: input.phone?.trim() || undefined,
      documentType: input.documentType,
      documentNumber: normalizedDocumentNumber,
      studentCode: input.studentCode?.trim() || undefined,
      institutionId: institution.id,
    });

    const verificationCode = randomInt(
      10 ** (EMAIL_VERIFICATION_CODE_LENGTH - 1),
      10 ** EMAIL_VERIFICATION_CODE_LENGTH,
    ).toString();
    const verificationCodeHash = createHash('sha256')
      .update(verificationCode)
      .digest('hex');
    const expiresAt = new Date(
      Date.now() + this.environmentService.emailVerificationTokenTtlMinutes * 60 * 1000,
    );

    await this.authUserRepository.createEmailVerificationCode(
      createdUser.id,
      verificationCodeHash,
      expiresAt,
    );

    await this.auditService.record({
      institutionId: institution.id,
      actorUserId: createdUser.id,
      action: AuditAction.AuthRegistered,
      entityType: AuditEntityType.User,
      entityId: createdUser.id,
      metadata: {
        email: createdUser.email,
      },
    });

    return {
      message: 'Cuenta creada correctamente. Usa el codigo de verificacion para activarla.',
      verificationCode,
      user: {
        id: createdUser.id,
        email: createdUser.email,
        fullName: createdUser.fullName,
      },
    };
  }
}
