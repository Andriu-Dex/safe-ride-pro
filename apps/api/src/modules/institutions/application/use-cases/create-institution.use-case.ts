import { BadRequestException, Inject, Injectable } from '@nestjs/common';

import {
  CreateInstitutionInput,
  INSTITUTIONS_REPOSITORY,
  InstitutionsRepository,
} from '../ports/institutions.repository';

@Injectable()
export class CreateInstitutionUseCase {
  constructor(
    @Inject(INSTITUTIONS_REPOSITORY)
    private readonly institutionsRepository: InstitutionsRepository,
  ) {}

  async execute(input: CreateInstitutionInput) {
    const normalizedDomains = [...new Set(input.domains.map((domain) => domain.trim().toLowerCase()))]
      .filter(Boolean);

    if (normalizedDomains.length === 0) {
      throw new BadRequestException('At least one active institutional domain is required.');
    }

    return this.institutionsRepository.create({
      name: input.name.trim(),
      code: input.code.trim().toUpperCase(),
      domains: normalizedDomains,
    });
  }
}
