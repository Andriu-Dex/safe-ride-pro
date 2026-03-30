import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { isValidEcuadorianMobilePhone } from '@saferidepro/shared-types';

import {
  UpdateUserProfileInput,
  USERS_REPOSITORY,
  UsersRepository,
} from '../ports/users.repository';

@Injectable()
export class UpdateCurrentUserUseCase {
  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepository,
  ) {}

  execute(userId: string, input: UpdateUserProfileInput) {
    const normalizedPhone = input.phone?.trim();

    if (normalizedPhone && !isValidEcuadorianMobilePhone(normalizedPhone)) {
      throw new BadRequestException('El celular debe tener 10 digitos y empezar con 09.');
    }

    return this.usersRepository.updateProfile(userId, {
      ...input,
      phone: normalizedPhone,
      fullName: input.fullName?.trim(),
      profilePhotoUrl: input.profilePhotoUrl?.trim(),
    });
  }
}
