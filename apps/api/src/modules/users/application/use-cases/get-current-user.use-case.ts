import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import { USERS_REPOSITORY, UsersRepository } from '../ports/users.repository';

@Injectable()
export class GetCurrentUserUseCase {
  constructor(
    @Inject(USERS_REPOSITORY)
    private readonly usersRepository: UsersRepository,
  ) {}

  async execute(userId: string) {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new NotFoundException('The requested user was not found.');
    }

    return user;
  }
}
