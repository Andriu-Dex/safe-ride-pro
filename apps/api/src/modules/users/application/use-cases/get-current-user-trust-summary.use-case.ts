import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  isOperationalMembership,
  SANCTION_OPERATIONAL_WINDOW_DAYS,
  SANCTION_REPORTS_WINDOW_DAYS,
  selectOperationalMembership,
} from '@saferidepro/shared-types';

import { OperationalSanctionsService } from '../../../sanctions/application/services/operational-sanctions.service';
import { USERS_REPOSITORY, UsersRepository } from '../ports/users.repository';

@Injectable()
export class GetCurrentUserTrustSummaryUseCase {
  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepository,
    private readonly operationalSanctionsService: OperationalSanctionsService,
  ) {}

  async execute(userId: string) {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('El usuario solicitado no existe.');
    }

    const membership = selectOperationalMembership(user.memberships);

    if (!membership || !isOperationalMembership(membership)) {
      throw new ForbiddenException(
        'No tienes una membresia activa para consultar tu resumen de confianza.',
      );
    }

    const [trustSummary, activeSanctions] = await Promise.all([
      this.usersRepository.getTrustSummary(membership.id),
      this.operationalSanctionsService.synchronizeAutomaticSanctions(membership.id),
    ]);

    return {
      ...trustSummary,
      sanctionPolicy: {
        operationalWindowDays: SANCTION_OPERATIONAL_WINDOW_DAYS,
        reportsWindowDays: SANCTION_REPORTS_WINDOW_DAYS,
        lastComputedAt: new Date(),
      },
      activeSanctions,
    };
  }
}
