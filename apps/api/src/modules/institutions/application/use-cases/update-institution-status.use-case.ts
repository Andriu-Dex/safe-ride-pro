import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import {
  INSTITUTIONS_REPOSITORY,
  InstitutionsRepository,
} from '../ports/institutions.repository';

export type UpdateInstitutionStatusCommand = {
  institutionId: string;
  isActive: boolean;
};

@Injectable()
export class UpdateInstitutionStatusUseCase {
  constructor(
    @Inject(INSTITUTIONS_REPOSITORY)
    private readonly institutionsRepository: InstitutionsRepository,
  ) {}

  async execute(command: UpdateInstitutionStatusCommand) {
    const institution = await this.institutionsRepository.findById(command.institutionId);

    if (!institution) {
      throw new NotFoundException('La institucion indicada no existe.');
    }

    if (institution.isActive === command.isActive) {
      return {
        message: command.isActive
          ? 'La institucion ya se encuentra activa.'
          : 'La institucion ya se encuentra suspendida.',
        institution,
      };
    }

    const updatedInstitution = await this.institutionsRepository.updateStatus(
      command.institutionId,
      command.isActive,
    );

    return {
      message: command.isActive
        ? 'La institucion fue reactivada correctamente.'
        : 'La institucion fue suspendida correctamente.',
      institution: updatedInstitution,
    };
  }
}
