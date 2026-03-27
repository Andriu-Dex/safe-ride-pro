import { Inject, Injectable } from '@nestjs/common';

import {
  INSTITUTIONS_REPOSITORY,
  InstitutionsRepository,
} from '../ports/institutions.repository';

@Injectable()
export class ListActiveInstitutionsUseCase {
  constructor(
    @Inject(INSTITUTIONS_REPOSITORY)
    private readonly institutionsRepository: InstitutionsRepository,
  ) {}

  execute() {
    return this.institutionsRepository.listActive();
  }
}
