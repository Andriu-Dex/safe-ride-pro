import { Inject, Injectable } from '@nestjs/common';
import { OperationalSanctionAppealStatus } from '@saferidepro/shared-types';

import type { CurrentUserContext } from '../../../auth/application/types/current-user-context.type';
import {
  SANCTIONS_REPOSITORY,
  SanctionsRepository,
} from '../ports/sanctions.repository';
import { resolveReviewableInstitutionScope } from '../utils/sanctions-admin-access';

export type ListReviewableSanctionAppealsCommand = {
  currentUser: CurrentUserContext;
  institutionId?: string;
  status?: OperationalSanctionAppealStatus;
  limit?: number;
};

@Injectable()
export class ListReviewableSanctionAppealsUseCase {
  constructor(
    @Inject(SANCTIONS_REPOSITORY)
    private readonly sanctionsRepository: SanctionsRepository,
  ) {}

  async execute(command: ListReviewableSanctionAppealsCommand) {
    const institutionIds = resolveReviewableInstitutionScope(
      command.currentUser,
      command.institutionId,
    );
    const items = await this.sanctionsRepository.listReviewableOperationalSanctionAppeals({
      institutionIds,
      status: command.status,
      limit: command.limit,
    });

    return {
      items,
    };
  }
}
