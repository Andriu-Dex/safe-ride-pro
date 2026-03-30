import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GlobalUserRole,
  OperationalSanctionAppealStatus,
  SANCTION_APPEAL_REVIEW_NOTE_MIN_LENGTH,
} from '@saferidepro/shared-types';

import { AuditService } from '../../../audit/application/services/audit.service';
import { AuditAction, AuditEntityType } from '../../../audit/domain/audit.types';
import type { CurrentUserContext } from '../../../auth/application/types/current-user-context.type';
import { OperationalSanctionsService } from '../services/operational-sanctions.service';
import {
  SANCTIONS_REPOSITORY,
  SanctionsRepository,
} from '../ports/sanctions.repository';
import { isOperationalSanctionCurrentlyActive } from '../utils/operational-sanction-state';
import { resolveReviewableInstitutionScope } from '../utils/sanctions-admin-access';

export type ReviewSanctionAppealCommand = {
  appealId: string;
  status: OperationalSanctionAppealStatus;
  reviewNote?: string;
};

@Injectable()
export class ReviewSanctionAppealUseCase {
  constructor(
    @Inject(SANCTIONS_REPOSITORY)
    private readonly sanctionsRepository: SanctionsRepository,
    private readonly operationalSanctionsService: OperationalSanctionsService,
    private readonly auditService: AuditService,
  ) {}

  async execute(currentUser: CurrentUserContext, command: ReviewSanctionAppealCommand) {
    const appeal = await this.sanctionsRepository.findAppealById(command.appealId);

    if (!appeal) {
      throw new NotFoundException('La apelacion indicada no existe.');
    }

    const accessibleInstitutionIds = resolveReviewableInstitutionScope(
      currentUser,
      appeal.institutionId,
    );

    if (
      currentUser.globalRole !== GlobalUserRole.SuperAdmin &&
      !accessibleInstitutionIds?.includes(appeal.institutionId)
    ) {
      throw new ForbiddenException(
        'No tienes permisos para revisar apelaciones de esa institucion.',
      );
    }

    if (
      currentUser.id === appeal.affectedUserId ||
      currentUser.id === appeal.requestedByUserId
    ) {
      throw new ForbiddenException(
        'No puedes revisar una apelacion asociada directamente a tu propia sancion.',
      );
    }

    if (appeal.status !== OperationalSanctionAppealStatus.Pending) {
      throw new BadRequestException('La apelacion ya fue revisada anteriormente.');
    }

    if (command.status === OperationalSanctionAppealStatus.Pending) {
      throw new BadRequestException(
        'No se puede volver a dejar la apelacion en estado pendiente.',
      );
    }

    const normalizedReviewNote = command.reviewNote?.trim();

    if (
      !normalizedReviewNote ||
      normalizedReviewNote.length < SANCTION_APPEAL_REVIEW_NOTE_MIN_LENGTH
    ) {
      throw new BadRequestException(
        `Debes indicar una nota administrativa de al menos ${SANCTION_APPEAL_REVIEW_NOTE_MIN_LENGTH} caracteres para revisar la apelacion.`,
      );
    }

    if (
      command.status === OperationalSanctionAppealStatus.Approved &&
      isOperationalSanctionCurrentlyActive(
        {
          status: appeal.sanctionStatus,
          endsAt: appeal.sanctionEndsAt,
        },
        new Date(),
      )
    ) {
      await this.operationalSanctionsService.liftSanctionManually({
        sanctionId: appeal.sanctionId,
        actorUserId: currentUser.id,
        reviewNote: normalizedReviewNote,
        relatedAppealId: appeal.id,
      });
    }

    const updatedAppeal = await this.sanctionsRepository.reviewOperationalSanctionAppeal({
      appealId: appeal.id,
      reviewerUserId: currentUser.id,
      status: command.status,
      reviewNote: normalizedReviewNote,
    });

    await this.auditService.record({
      actorUserId: currentUser.id,
      institutionId: appeal.institutionId,
      action:
        command.status === OperationalSanctionAppealStatus.Approved
          ? AuditAction.SanctionAppealApproved
          : AuditAction.SanctionAppealRejected,
      entityType: AuditEntityType.SanctionAppeal,
      entityId: appeal.id,
      metadata: {
        sanctionId: appeal.sanctionId,
        sanctionType: appeal.sanctionType,
        sanctionScope: appeal.sanctionScope,
        reviewNote: normalizedReviewNote,
      },
    });

    return {
      message: 'Apelacion revisada correctamente.',
      appeal: updatedAppeal,
    };
  }
}
