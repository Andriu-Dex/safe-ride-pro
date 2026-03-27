import { Inject, Injectable } from '@nestjs/common';

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
    return this.usersRepository.updateProfile(userId, input);
  }
}
