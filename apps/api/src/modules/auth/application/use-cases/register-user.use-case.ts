import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common';
import {
  DocumentType,
  generateEmailVerificationCode,
  isValidEcuadorianMobilePhone,
  isValidEcuadorianNationalId,
} from '@saferidepro/shared-types';
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
  AuthUserDocumentConflictError,
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
  deliveryChannel: AuthEmailDeliveryChannel;
  verificationCode?: string;
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
    @Inject(AUTH_EMAIL_SERVICE)
    private readonly authEmailService: AuthEmailService,
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
    const normalizedPhone = input.phone?.trim() || undefined;

    if (
      input.documentType === DocumentType.NationalId &&
      !isValidEcuadorianNationalId(normalizedDocumentNumber)
    ) {
      throw new BadRequestException('La cedula ecuatoriana no es valida.');
    }

    if (normalizedPhone && !isValidEcuadorianMobilePhone(normalizedPhone)) {
      throw new BadRequestException('El celular debe tener 10 digitos y empezar con 09.');
    }

    const passwordHash = await this.passwordHasher.hash(input.password);

    let createdUser;

    try {
      createdUser = await this.authUserRepository.createUserWithMembership({
        email: normalizedEmail,
        passwordHash,
        fullName: input.fullName.trim(),
        phone: normalizedPhone,
        documentType: input.documentType,
        documentNumber: normalizedDocumentNumber,
        studentCode: input.studentCode?.trim() || undefined,
        institutionId: institution.id,
      });
    } catch (error) {
      if (error instanceof AuthUserDocumentConflictError) {
        throw new ConflictException(
          'Ya existe una cuenta registrada con este tipo y numero de documento.',
        );
      }

      throw error;
    }

    const verificationCode = generateEmailVerificationCode();
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

    const deliveryChannel = await this.authEmailService.sendVerificationCodeEmail({
      email: createdUser.email,
      fullName: createdUser.fullName,
      code: verificationCode,
      expiresInMinutes: this.environmentService.emailVerificationTokenTtlMinutes,
    });

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
      message: 'Cuenta creada correctamente. Revisa tu correo para verificar la cuenta.',
      deliveryChannel,
      verificationCode:
        this.environmentService.authAllowDebugCodes && deliveryChannel === 'development_preview'
        ? verificationCode
        : undefined,
      user: {
        id: createdUser.id,
        email: createdUser.email,
        fullName: createdUser.fullName,
      },
    };
  }
}
