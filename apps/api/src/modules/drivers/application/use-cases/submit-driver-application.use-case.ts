import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import {
  DriverVerificationStatus,
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
  licenseNumber: string;
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

    if (membership.driverVerificationStatus === DriverVerificationStatus.Suspended) {
      throw new ForbiddenException('Tu perfil de conductor se encuentra suspendido.');
    }

    const licenseExpiresAt = new Date(command.licenseExpiresAt);

    if (Number.isNaN(licenseExpiresAt.getTime())) {
      throw new BadRequestException('La fecha de expiracion de la licencia no es valida.');
    }

    if (licenseExpiresAt <= new Date()) {
      throw new BadRequestException('La licencia ingresada ya se encuentra vencida.');
    }

    const normalizedLicenseNumber = command.licenseNumber.trim().toUpperCase();
    const existingProfile = await this.driversRepository.findDriverProfileByLicenseNumber(
      normalizedLicenseNumber,
    );

    if (existingProfile && existingProfile.membershipId !== membership.id) {
      throw new BadRequestException('El numero de licencia ya esta registrado en otra solicitud.');
    }

    const driverProfile = await this.driversRepository.submitDriverApplication({
      membershipId: membership.id,
      licenseTypeId: command.licenseTypeId,
      licenseNumber: normalizedLicenseNumber,
      licenseExpiresAt,
      identityDocumentFileKey: command.identityDocumentFileKey?.trim() || undefined,
      licenseDocumentFileKey: command.licenseDocumentFileKey?.trim() || undefined,
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