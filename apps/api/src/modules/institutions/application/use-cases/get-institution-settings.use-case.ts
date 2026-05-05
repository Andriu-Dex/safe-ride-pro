import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { CurrentUserContext } from '../../../auth/application/types/current-user-context.type';
import {
  INSTITUTIONS_REPOSITORY,
  InstitutionsRepository,
} from '../ports/institutions.repository';
import { resolveReadableInstitutionId } from './institution-settings-access';

@Injectable()
export class GetInstitutionSettingsUseCase {
  constructor(
    @Inject(INSTITUTIONS_REPOSITORY)
    private readonly institutionsRepository: InstitutionsRepository,
  ) {}

  async execute(currentUser: CurrentUserContext, requestedInstitutionId?: string) {
    const institutionId = resolveReadableInstitutionId(currentUser, requestedInstitutionId);
    const institution = await this.institutionsRepository.findById(institutionId);

    if (!institution) {
      throw new NotFoundException('La institucion indicada no existe.');
    }

    const settings = await this.institutionsRepository.getSettings(institutionId);

    return {
      institution,
      settings,
    };
  }
}
