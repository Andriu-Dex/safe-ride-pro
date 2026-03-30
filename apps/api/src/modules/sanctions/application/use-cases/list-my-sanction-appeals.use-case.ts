import { Inject, Injectable } from '@nestjs/common';

import type { CurrentUserContext } from '../../../auth/application/types/current-user-context.type';
import {
  SANCTIONS_REPOSITORY,
  SanctionsRepository,
} from '../ports/sanctions.repository';

@Injectable()
export class ListMySanctionAppealsUseCase {
  constructor(
    @Inject(SANCTIONS_REPOSITORY)
    private readonly sanctionsRepository: SanctionsRepository,
  ) {}

  async execute(currentUser: CurrentUserContext) {
    const items = await this.sanctionsRepository.listAppealsByRequestedByUserId(
      currentUser.id,
    );

    return {
      items,
    };
  }
}
