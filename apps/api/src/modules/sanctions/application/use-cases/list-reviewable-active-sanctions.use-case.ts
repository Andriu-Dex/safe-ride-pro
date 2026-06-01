import { Injectable, Inject } from '@nestjs/common';

import type { CurrentUserContext } from '../../../auth/application/types/current-user-context.type';
import {
  SANCTIONS_REPOSITORY,
  SanctionsRepository,
} from '../ports/sanctions.repository';
import { resolveReviewableInstitutionScope } from '../utils/sanctions-admin-access';

export type ListReviewableActiveSanctionsCommand = {
  currentUser: CurrentUserContext;
  institutionId?: string;
  userId?: string;
  limit?: number;
};

@Injectable()
export class ListReviewableActiveSanctionsUseCase {
  constructor(
    @Inject(SANCTIONS_REPOSITORY)
    private readonly sanctionsRepository: SanctionsRepository,
  ) {}

  async execute(command: ListReviewableActiveSanctionsCommand) {
    const institutionIds = resolveReviewableInstitutionScope(
      command.currentUser,
      command.institutionId,
    );
    const items = await this.sanctionsRepository.listReviewableActiveSanctions({
      institutionIds,
      userId: command.userId,
      limit: command.limit,
      asOf: new Date(),
    });

    return {
      items,
    };
  }
}
