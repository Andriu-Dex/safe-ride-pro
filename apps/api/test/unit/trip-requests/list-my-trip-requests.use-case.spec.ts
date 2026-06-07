import { ForbiddenException } from '@nestjs/common';
import { MembershipStatus } from '@saferidepro/shared-types';
import { ListMyTripRequestsUseCase } from '../../../src/modules/trip-requests/application/use-cases/list-my-trip-requests.use-case';
import type { TripRequestsRepository } from '../../../src/modules/trip-requests/application/ports/trip-requests.repository';

describe('ListMyTripRequestsUseCase', () => {
  it('returns items from repository based on passenger membership id', async () => {
    const repository: jest.Mocked<TripRequestsRepository> = {
      findDefaultMembershipByUserId: jest.fn().mockResolvedValue({
        id: 'membership-passenger-1',
        membershipStatus: MembershipStatus.Active,
      }),
      listTripRequestsByPassengerMembershipId: jest.fn().mockResolvedValue([{ id: 'request-1' }]),
    } as any;

    const useCase = new ListMyTripRequestsUseCase(repository);
    const result = await useCase.execute('user-passenger-1');

    expect(result).toEqual({ items: [{ id: 'request-1' }] });
    expect(repository.findDefaultMembershipByUserId).toHaveBeenCalledWith('user-passenger-1');
    expect(repository.listTripRequestsByPassengerMembershipId).toHaveBeenCalledWith('membership-passenger-1');
  });

  it('throws ForbiddenException if user has no membership', async () => {
    const repository: jest.Mocked<TripRequestsRepository> = {
      findDefaultMembershipByUserId: jest.fn().mockResolvedValue(null),
    } as any;

    const useCase = new ListMyTripRequestsUseCase(repository);
    await expect(useCase.execute('user-passenger-1')).rejects.toThrow(
      new ForbiddenException('No tienes una membresia activa para consultar solicitudes.'),
    );
  });

  it('throws ForbiddenException if user membership is inactive', async () => {
    const repository: jest.Mocked<TripRequestsRepository> = {
      findDefaultMembershipByUserId: jest.fn().mockResolvedValue({
        id: 'membership-passenger-1',
        membershipStatus: MembershipStatus.Suspended,
      }),
    } as any;

    const useCase = new ListMyTripRequestsUseCase(repository);
    await expect(useCase.execute('user-passenger-1')).rejects.toThrow(
      new ForbiddenException('No tienes una membresia activa para consultar solicitudes.'),
    );
  });
});
