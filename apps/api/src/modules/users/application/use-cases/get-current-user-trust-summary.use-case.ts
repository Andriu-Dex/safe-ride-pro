import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  deriveTrustReputationProfile,
  isOperationalMembership,
  SANCTION_OPERATIONAL_WINDOW_DAYS,
  SANCTION_REPORTS_WINDOW_DAYS,
  selectOperationalMembership,
} from '@saferidepro/shared-types';

import { OperationalSanctionsService } from '../../../sanctions/application/services/operational-sanctions.service';
import {
  DEFAULT_REPUTATION_POLICY,
  USERS_REPOSITORY,
  UsersRepository,
} from '../ports/users.repository';

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

    const [trustSummaryMetrics, activeSanctions] = await Promise.all([
      this.usersRepository.getTrustSummary(membership.id),
      this.operationalSanctionsService.synchronizeAutomaticSanctions(membership.id),
    ]);
    const sanctionHistory = await this.operationalSanctionsService.getRecentSanctionHistory(
      membership.id,
    );

    const reputationProfile = deriveTrustReputationProfile({
      ...trustSummaryMetrics,
      activeSanctions: activeSanctions.map((sanction) => ({
        type: sanction.type,
        scope: sanction.scope,
      })),
      recentSanctionCount: sanctionHistory.recentSanctionCount,
      recentBlockingSanctionCount: sanctionHistory.recentBlockingSanctionCount,
    });

    return {
      ...trustSummaryMetrics,
      completedInteractions: reputationProfile.completedInteractions,
      hasEnoughRatingsSignal: reputationProfile.hasEnoughRatingsSignal,
      hasLowRatingSignal: reputationProfile.hasLowRatingSignal,
      visibleReputationState: reputationProfile.visibleReputationState,
      administrativeRiskState: reputationProfile.administrativeRiskState,
      riskSignals: reputationProfile.riskSignals,
      reputationPolicy: {
        ...DEFAULT_REPUTATION_POLICY,
        lastComputedAt: sanctionHistory.lastComputedAt,
      },
      sanctionPolicy: {
        operationalWindowDays: SANCTION_OPERATIONAL_WINDOW_DAYS,
        reportsWindowDays: SANCTION_REPORTS_WINDOW_DAYS,
        lastComputedAt: new Date(),
      },
      recentSanctionCount: sanctionHistory.recentSanctionCount,
      recentBlockingSanctionCount: sanctionHistory.recentBlockingSanctionCount,
      activeSanctions,
    };
  }
}
