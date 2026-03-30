import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  GlobalUserRole,
  MANUAL_SANCTION_LIFT_NOTE_MIN_LENGTH,
} from '@saferidepro/shared-types';

import type { CurrentUserContext } from '../../../auth/application/types/current-user-context.type';
import { OperationalSanctionsService } from '../services/operational-sanctions.service';
import {
  SANCTIONS_REPOSITORY,
  SanctionsRepository,
} from '../ports/sanctions.repository';
import { resolveReviewableInstitutionScope } from '../utils/sanctions-admin-access';

export type LiftOperationalSanctionCommand = {
  sanctionId: string;
  reviewNote?: string;
};

@Injectable()
export class LiftOperationalSanctionUseCase {
  constructor(
    @Inject(SANCTIONS_REPOSITORY)
    private readonly sanctionsRepository: SanctionsRepository,
    private readonly operationalSanctionsService: OperationalSanctionsService,
  ) {}

  async execute(currentUser: CurrentUserContext, command: LiftOperationalSanctionCommand) {
    const sanction = await this.sanctionsRepository.findSanctionDetailById(command.sanctionId);

    if (!sanction) {
      throw new NotFoundException('La sancion indicada no existe.');
    }

    const accessibleInstitutionIds = resolveReviewableInstitutionScope(
      currentUser,
      sanction.institutionId,
    );

    if (
      currentUser.globalRole !== GlobalUserRole.SuperAdmin &&
      !accessibleInstitutionIds?.includes(sanction.institutionId)
    ) {
      throw new ForbiddenException(
        'No tienes permisos para levantar sanciones de esa institucion.',
      );
    }

    if (currentUser.id === sanction.membershipUserId) {
      throw new ForbiddenException('No puedes levantar manualmente tu propia sancion.');
    }

    const normalizedReviewNote = command.reviewNote?.trim();

    if (
      !normalizedReviewNote ||
      normalizedReviewNote.length < MANUAL_SANCTION_LIFT_NOTE_MIN_LENGTH
    ) {
      throw new BadRequestException(
        `Debes indicar una nota administrativa de al menos ${MANUAL_SANCTION_LIFT_NOTE_MIN_LENGTH} caracteres para levantar la sancion.`,
      );
    }

    const appeal = await this.sanctionsRepository.findAppealBySanctionId(sanction.id);

    if (appeal?.status === 'PENDING') {
      throw new BadRequestException(
        'La sancion tiene una apelacion pendiente. Revisa la apelacion antes de levantarla manualmente.',
      );
    }

    const updatedSanction = await this.operationalSanctionsService.liftSanctionManually({
      sanctionId: sanction.id,
      actorUserId: currentUser.id,
      reviewNote: normalizedReviewNote,
    });

    return {
      message: 'Sancion levantada manualmente correctamente.',
      sanction: updatedSanction,
    };
  }
}
