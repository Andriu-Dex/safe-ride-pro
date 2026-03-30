import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  DriverLicenseStatus,
  DriverVerificationStatus,
  GlobalUserRole,
  InstitutionMembershipRole,
  isOperationalMembership,
  MembershipStatus,
} from '@saferidepro/shared-types';

import { AuditService } from '../../../audit/application/services/audit.service';
import { AuditAction, AuditEntityType } from '../../../audit/domain/audit.types';
import { CurrentUserContext } from '../../../auth/application/types/current-user-context.type';
import {
  DRIVERS_REPOSITORY,
  DriversRepository,
} from '../ports/drivers.repository';

export type ReviewDriverApplicationCommand = {
  membershipId: string;
  decision: DriverVerificationStatus.Approved | DriverVerificationStatus.Rejected;
  reviewNotes?: string;
};

@Injectable()
export class ReviewDriverApplicationUseCase {
  constructor(
    @Inject(DRIVERS_REPOSITORY)
    private readonly driversRepository: DriversRepository,
    private readonly auditService: AuditService,
  ) {}

  async execute(currentUser: CurrentUserContext, command: ReviewDriverApplicationCommand) {
    const targetMembership = await this.driversRepository.findMembershipById(command.membershipId);

    if (!targetMembership) {
      throw new NotFoundException('La solicitud de conductor no existe.');
    }

    const canReview =
      currentUser.globalRole === GlobalUserRole.SuperAdmin ||
      currentUser.memberships.some(
        (membership) =>
          membership.institutionId === targetMembership.institutionId &&
          membership.role === InstitutionMembershipRole.InstitutionAdmin &&
          isOperationalMembership(membership),
      );

    if (!canReview) {
      throw new ForbiddenException('No tienes permisos para revisar solicitudes de esta institucion.');
    }

    if (targetMembership.userId === currentUser.id) {
      throw new ForbiddenException(
        'No puedes revisar tu propia solicitud de conductor.',
      );
    }

    if (targetMembership.membershipStatus !== MembershipStatus.Active) {
      throw new BadRequestException(
        'Solo puedes revisar solicitudes asociadas a membresias activas.',
      );
    }

    const driverProfile = await this.driversRepository.findDriverProfileByMembershipId(command.membershipId);

    if (!driverProfile) {
      throw new NotFoundException('La solicitud de conductor aun no ha sido enviada.');
    }

    if (
      command.decision === DriverVerificationStatus.Rejected &&
      !command.reviewNotes?.trim()
    ) {
      throw new BadRequestException('Debes indicar el motivo del rechazo.');
    }

    if (
      command.decision === DriverVerificationStatus.Approved &&
      driverProfile.licenseStatus === DriverLicenseStatus.Expired
    ) {
      throw new BadRequestException(
        'No puedes aprobar una solicitud con la licencia vencida.',
      );
    }

    if (
      command.decision === DriverVerificationStatus.Approved &&
      !driverProfile.hasRequiredDocuments
    ) {
      throw new BadRequestException(
        'Debes contar con documento de identidad y licencia adjuntos antes de aprobar la solicitud.',
      );
    }

    const updatedProfile = await this.driversRepository.reviewDriverApplication({
      membershipId: command.membershipId,
      reviewerUserId: currentUser.id,
      decision: command.decision,
      reviewNotes: command.reviewNotes?.trim() || undefined,
    });

    await this.auditService.record({
      institutionId: targetMembership.institutionId,
      actorUserId: currentUser.id,
      action:
        command.decision === DriverVerificationStatus.Approved
          ? AuditAction.DriverApplicationApproved
          : AuditAction.DriverApplicationRejected,
      entityType: AuditEntityType.DriverProfile,
      entityId: command.membershipId,
      metadata: {
        decision: command.decision,
      },
    });

    return {
      message:
        command.decision === DriverVerificationStatus.Approved
          ? 'La solicitud de conductor fue aprobada correctamente.'
          : 'La solicitud de conductor fue rechazada correctamente.',
      driverProfile: updatedProfile,
    };
  }
}
