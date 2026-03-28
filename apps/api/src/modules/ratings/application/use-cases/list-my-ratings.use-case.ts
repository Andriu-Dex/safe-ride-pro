import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { MembershipStatus } from '@saferidepro/shared-types';

import {
  RATINGS_REPOSITORY,
  RatingsRepository,
} from '../ports/ratings.repository';

@Injectable()
export class ListMyRatingsUseCase {
  constructor(
    @Inject(RATINGS_REPOSITORY)
    private readonly ratingsRepository: RatingsRepository,
  ) {}

  async execute(userId: string) {
    const membership = await this.ratingsRepository.findDefaultMembershipByUserId(userId);

    if (!membership || membership.membershipStatus !== MembershipStatus.Active) {
      throw new ForbiddenException('No tienes una membresia activa para consultar calificaciones.');
    }

    const ratings = await this.ratingsRepository.listRatingsForMembershipId(membership.id);

    return {
      given: ratings.filter((rating) => rating.authorMembershipId === membership.id),
      received: ratings.filter((rating) => rating.targetMembershipId === membership.id),
    };
  }
}