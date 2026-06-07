import { ForbiddenException } from '@nestjs/common';
import { MembershipStatus } from '@saferidepro/shared-types';
import { ListDriverTripRequestsUseCase } from '../../../src/modules/trip-requests/application/use-cases/list-driver-trip-requests.use-case';
import type { TripRequestsRepository } from '../../../src/modules/trip-requests/application/ports/trip-requests.repository';

describe('ListDriverTripRequestsUseCase', () => {
  it('returns items from repository based on driver membership id', async () => {
    const repository: jest.Mocked<TripRequestsRepository> = {
      findDefaultMembershipByUserId: jest.fn().mockResolvedValue({
        id: 'membership-driver-1',
        membershipStatus: MembershipStatus.Active,
      }),
      listTripRequestsByDriverMembershipId: jest.fn().mockResolvedValue([{ id: 'request-1' }]),
    } as any;

    const useCase = new ListDriverTripRequestsUseCase(repository);
    const result = await useCase.execute('user-driver-1');

    expect(result).toEqual({ items: [{ id: 'request-1' }] });
    expect(repository.findDefaultMembershipByUserId).toHaveBeenCalledWith('user-driver-1');
    expect(repository.listTripRequestsByDriverMembershipId).toHaveBeenCalledWith('membership-driver-1');
  });

  it('throws ForbiddenException if user has no membership', async () => {
    const repository: jest.Mocked<TripRequestsRepository> = {
      findDefaultMembershipByUserId: jest.fn().mockResolvedValue(null),
    } as any;

    const useCase = new ListDriverTripRequestsUseCase(repository);
    await expect(useCase.execute('user-driver-1')).rejects.toThrow(
      new ForbiddenException('No tienes una membresia activa para consultar solicitudes entrantes.'),
    );
  });

  it('throws ForbiddenException if user membership is inactive', async () => {
    const repository: jest.Mocked<TripRequestsRepository> = {
      findDefaultMembershipByUserId: jest.fn().mockResolvedValue({
        id: 'membership-driver-1',
        membershipStatus: MembershipStatus.Inactive,
      }),
    } as any;

    const useCase = new ListDriverTripRequestsUseCase(repository);
    await expect(useCase.execute('user-driver-1')).rejects.toThrow(
      new ForbiddenException('No tienes una membresia activa para consultar solicitudes entrantes.'),
    );
  });
});
