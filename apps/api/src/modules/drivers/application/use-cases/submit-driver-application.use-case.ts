import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  DriverVerificationStatus,
  InstitutionMembershipRole,
  MembershipStatus,
} from '@saferidepro/shared-types';

import { AuditService } from '../../../audit/application/services/audit.service';
import { AuditAction, AuditEntityType } from '../../../audit/domain/audit.types';
import {
  DRIVERS_REPOSITORY,
  DriversRepository,
} from '../ports/drivers.repository';

export type SubmitDriverApplicationCommand = {
  userId: string;
  licenseTypeId: string;
  licenseExpiresAt: string;
  identityDocumentFileKey?: string;
  licenseDocumentFileKey?: string;
};

@Injectable()
export class SubmitDriverApplicationUseCase {
  constructor(
    @Inject(DRIVERS_REPOSITORY)
    private readonly driversRepository: DriversRepository,
    private readonly auditService: AuditService,
  ) {}

  async execute(command: SubmitDriverApplicationCommand) {
    const membership = await this.driversRepository.findDefaultMembershipByUserId(command.userId);

    if (!membership || membership.membershipStatus !== MembershipStatus.Active) {
      throw new ForbiddenException('No tienes una membresia activa para solicitar habilitacion como conductor.');
    }

    if (membership.role === InstitutionMembershipRole.InstitutionAdmin) {
      throw new ForbiddenException(
        'La membresia administrativa no puede solicitar habilitacion como conductor.',
      );
    }

    if (membership.driverVerificationStatus === DriverVerificationStatus.Suspended) {
      throw new ForbiddenException('Tu perfil de conductor se encuentra suspendido.');
    }

    if (
      membership.effectiveDriverVerificationStatus ===
      DriverVerificationStatus.Approved
    ) {
      throw new ForbiddenException(
        'Tu perfil de conductor ya fue aprobado. Si necesitas actualizar documentos, contacta a administracion.',
      );
    }

    const licenseExpiresAt = new Date(command.licenseExpiresAt);

    if (Number.isNaN(licenseExpiresAt.getTime())) {
      throw new BadRequestException('La fecha de expiracion de la licencia no es valida.');
    }

    if (licenseExpiresAt <= new Date()) {
      throw new BadRequestException('La licencia ingresada ya se encuentra vencida.');
    }

    const identityDocumentFileKey = command.identityDocumentFileKey?.trim() || undefined;
    const licenseDocumentFileKey = command.licenseDocumentFileKey?.trim() || undefined;

    if (!identityDocumentFileKey || !licenseDocumentFileKey) {
      throw new BadRequestException(
        'Debes cargar el documento de identidad y el documento de licencia antes de enviar la solicitud.',
      );
    }

    const driverProfile = await this.driversRepository.submitDriverApplication({
      membershipId: membership.id,
      licenseTypeId: command.licenseTypeId,
      licenseExpiresAt,
      identityDocumentFileKey,
      licenseDocumentFileKey,
    });

    await this.auditService.record({
      institutionId: membership.institutionId,
      actorUserId: command.userId,
      action: AuditAction.DriverApplicationSubmitted,
      entityType: AuditEntityType.DriverProfile,
      entityId: driverProfile.membershipId,
      metadata: {
        driverVerificationStatus: driverProfile.driverVerificationStatus,
      },
    });

    return {
      message: 'Tu solicitud de conductor fue enviada y esta pendiente de revision.',
      driverProfile,
    };
  }
}
