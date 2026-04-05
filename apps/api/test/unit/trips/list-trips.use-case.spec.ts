import {
  DriverVerificationStatus,
  MembershipStatus,
  TripAvailabilityFilter,
  TripRouteMode,
  TripStatus,
  VehicleType,
} from '@saferidepro/shared-types';

import { ListTripsUseCase } from '../../../src/modules/trips/application/use-cases/list-trips.use-case';
import type { TripsRepository } from '../../../src/modules/trips/application/ports/trips.repository';

function createTripsRepositoryMock(): jest.Mocked<TripsRepository> {
  return {
    findDefaultMembershipByUserId: jest.fn(),
    findVehicleByIdForMembership: jest.fn(),
    createTrip: jest.fn(),
    findTripById: jest.fn(),
    listTrips: jest.fn(),
    findOverlappingTrips: jest.fn(),
    updateTripStatus: jest.fn(),
    cancelTripAndActiveRequests: jest.fn(),
    startTripAndClosePendingRequests: jest.fn(),
  };
}

describe('ListTripsUseCase', () => {
  it('builds filters for available trips using ecuador day bounds, time window and availability', async () => {
    const repository = createTripsRepositoryMock();
    const useCase = new ListTripsUseCase(repository);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
    });
    repository.listTrips.mockResolvedValue([]);

    await useCase.execute({
      userId: 'user-1',
      origin: 'Huachi',
      destination: 'Ficoa',
      dateFrom: '2030-01-10',
      dateTo: '2030-01-12',
      timeFrom: '07:30',
      timeTo: '09:15',
      routeMode: TripRouteMode.DirectRoute,
      vehicleType: VehicleType.Car,
      availability: TripAvailabilityFilter.Available,
    });

    expect(repository.listTrips).toHaveBeenCalledWith({
      institutionId: 'institution-1',
      statuses: [TripStatus.Published, TripStatus.Full],
      originSearch: 'Huachi',
      destinationSearch: 'Ficoa',
      dateFrom: new Date('2030-01-10T05:00:00.000Z'),
      dateTo: new Date('2030-01-13T04:59:59.999Z'),
      timeFromInMinutes: 450,
      timeToInMinutes: 555,
      routeMode: TripRouteMode.DirectRoute,
      vehicleType: VehicleType.Car,
      availability: TripAvailabilityFilter.Available,
    });
  });

  it('uses the current membership when listing only the user trips', async () => {
    const repository = createTripsRepositoryMock();
    const useCase = new ListTripsUseCase(repository);

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-2',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      driverVerificationStatus: DriverVerificationStatus.Approved,
    });
    repository.listTrips.mockResolvedValue([]);

    await useCase.execute({
      userId: 'user-1',
      mine: true,
      availability: TripAvailabilityFilter.Full,
      timeTo: '06:00',
    });

    expect(repository.listTrips).toHaveBeenCalledWith({
      driverMembershipId: 'membership-2',
      originSearch: undefined,
      destinationSearch: undefined,
      routeMode: undefined,
      vehicleType: undefined,
      availability: TripAvailabilityFilter.Full,
      timeFromInMinutes: undefined,
      timeToInMinutes: 360,
    });
  });
});
