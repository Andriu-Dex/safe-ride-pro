import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MembershipStatus } from '@saferidepro/shared-types';

import { USERS_REPOSITORY, UsersRepository } from '../ports/users.repository';

@Injectable()
export class GetCurrentUserTrustSummaryUseCase {
  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepository,
  ) {}

  async execute(userId: string) {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('El usuario solicitado no existe.');
    }

    const membership = user.memberships.find((item) => item.isDefault) ?? user.memberships[0];

    if (!membership || membership.membershipStatus !== MembershipStatus.Active) {
      throw new ForbiddenException(
        'No tienes una membresia activa para consultar tu resumen de confianza.',
      );
    }

    return this.usersRepository.getTrustSummary(membership.id);
  }
}
