import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OperationalSanctionType,
  SANCTION_APPEAL_REASON_MIN_LENGTH,
} from '@saferidepro/shared-types';

import { AuditService } from '../../../audit/application/services/audit.service';
import { AuditAction, AuditEntityType } from '../../../audit/domain/audit.types';
import type { CurrentUserContext } from '../../../auth/application/types/current-user-context.type';
import {
  SANCTIONS_REPOSITORY,
  SanctionsRepository,
} from '../ports/sanctions.repository';
import { isOperationalSanctionCurrentlyActive } from '../utils/operational-sanction-state';

export type SubmitSanctionAppealCommand = {
  sanctionId: string;
  reason: string;
};

@Injectable()
export class SubmitSanctionAppealUseCase {
  constructor(
    @Inject(SANCTIONS_REPOSITORY)
    private readonly sanctionsRepository: SanctionsRepository,
    private readonly auditService: AuditService,
  ) {}

  async execute(currentUser: CurrentUserContext, command: SubmitSanctionAppealCommand) {
    const sanction = await this.sanctionsRepository.findSanctionDetailById(command.sanctionId);

    if (!sanction) {
      throw new NotFoundException('La sancion indicada no existe.');
    }

    if (sanction.membershipUserId !== currentUser.id) {
      throw new ForbiddenException(
        'No tienes permisos para apelar una sancion asociada a otra membresia.',
      );
    }

    if (!isOperationalSanctionCurrentlyActive(sanction, new Date())) {
      throw new BadRequestException(
        'Solo puedes apelar sanciones que se encuentren activas actualmente.',
      );
    }

    if (sanction.type === OperationalSanctionType.Warning) {
      throw new BadRequestException(
        'Las advertencias activas no requieren apelacion administrativa en esta fase.',
      );
    }

    const normalizedReason = command.reason.trim();

    if (normalizedReason.length < SANCTION_APPEAL_REASON_MIN_LENGTH) {
      throw new BadRequestException(
        `La apelacion debe explicar el caso con al menos ${SANCTION_APPEAL_REASON_MIN_LENGTH} caracteres.`,
      );
    }

    const existingAppeal = await this.sanctionsRepository.findAppealBySanctionId(sanction.id);

    if (existingAppeal) {
      throw new BadRequestException(
        existingAppeal.status === 'PENDING'
          ? 'Ya existe una apelacion pendiente para esta sancion.'
          : 'La sancion indicada ya tiene una apelacion registrada.',
      );
    }

    const appeal = await this.sanctionsRepository.createOperationalSanctionAppeal({
      sanctionId: sanction.id,
      requestedByUserId: currentUser.id,
      reason: normalizedReason,
    });

    await this.auditService.record({
      actorUserId: currentUser.id,
      institutionId: sanction.institutionId,
      action: AuditAction.SanctionAppealSubmitted,
      entityType: AuditEntityType.SanctionAppeal,
      entityId: appeal.id,
      metadata: {
        sanctionId: sanction.id,
        sanctionType: sanction.type,
        sanctionScope: sanction.scope,
      },
    });

    return {
      message: 'Apelacion enviada correctamente para revision administrativa.',
      appeal,
    };
  }
}
