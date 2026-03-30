import { BadRequestException } from '@nestjs/common';

import type { UsersRepository } from '../../../src/modules/users/application/ports/users.repository';
import { UpdateCurrentUserUseCase } from '../../../src/modules/users/application/use-cases/update-current-user.use-case';

function createUsersRepositoryMock(): jest.Mocked<UsersRepository> {
  return {
    findById: jest.fn(),
    updateProfile: jest.fn(),
    getTrustSummary: jest.fn(),
  };
}

describe('UpdateCurrentUserUseCase', () => {
  it('rejects invalid Ecuadorian mobile phones', async () => {
    const repository = createUsersRepositoryMock();
    const useCase = new UpdateCurrentUserUseCase(repository);

    expect(() =>
      useCase.execute('user-1', {
        phone: '0812345678',
      }),
    ).toThrow(
      new BadRequestException('El celular debe tener 10 digitos y empezar con 09.'),
    );

    expect(repository.updateProfile).not.toHaveBeenCalled();
  });

  it('normalizes optional profile fields before persisting them', async () => {
    const repository = createUsersRepositoryMock();
    repository.updateProfile.mockResolvedValue({
      id: 'user-1',
      email: 'user@uta.edu.ec',
      fullName: 'Usuario Actualizado',
      phone: '0999999999',
      documentType: 'NATIONAL_ID',
      documentNumber: '1710034065',
      profilePhotoUrl: 'https://example.com/profile.jpg',
      globalRole: 'USER',
      accountStatus: 'ACTIVE',
      emailVerifiedAt: new Date(),
      memberships: [],
    } as never);
    const useCase = new UpdateCurrentUserUseCase(repository);

    await useCase.execute('user-1', {
      fullName: '  Usuario Actualizado  ',
      phone: ' 0999999999 ',
      profilePhotoUrl: ' https://example.com/profile.jpg ',
    });

    expect(repository.updateProfile).toHaveBeenCalledWith('user-1', {
      fullName: 'Usuario Actualizado',
      phone: '0999999999',
      profilePhotoUrl: 'https://example.com/profile.jpg',
    });
  });
});
