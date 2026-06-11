import { TripsController } from '../../../src/modules/trips/presentation/controllers/trips.controller';
import { CurrentUserContext } from '../../../src/modules/auth/application/types/current-user-context.type';
import { GlobalUserRole } from '@saferidepro/shared-types';

describe('TripsController', () => {
  let controller: TripsController;
  let createTripUseCase: any;
  let listTripsUseCase: any;
  let getTripByIdUseCase: any;
  let listRecentTripRouteTemplatesUseCase: any;
  let getTripLiveTrackingUseCase: any;
  let publishTripUseCase: any;
  let startTripUseCase: any;
  let updateTripUseCase: any;
  let completeTripUseCase: any;
  let cancelTripUseCase: any;
  let deleteDraftTripUseCase: any;
  let updateTripLiveTrackingUseCase: any;

  beforeEach(() => {
    createTripUseCase = { execute: jest.fn() };
    listTripsUseCase = { execute: jest.fn() };
    getTripByIdUseCase = { execute: jest.fn() };
    listRecentTripRouteTemplatesUseCase = { execute: jest.fn() };
    getTripLiveTrackingUseCase = { execute: jest.fn() };
    publishTripUseCase = { execute: jest.fn() };
    startTripUseCase = { execute: jest.fn() };
    updateTripUseCase = { execute: jest.fn() };
    completeTripUseCase = { execute: jest.fn() };
    cancelTripUseCase = { execute: jest.fn() };
    deleteDraftTripUseCase = { execute: jest.fn() };
    updateTripLiveTrackingUseCase = { execute: jest.fn() };

    controller = new TripsController(
      createTripUseCase,
      listTripsUseCase,
      getTripByIdUseCase,
      listRecentTripRouteTemplatesUseCase,
      getTripLiveTrackingUseCase,
      publishTripUseCase,
      startTripUseCase,
      updateTripUseCase,
      completeTripUseCase,
      cancelTripUseCase,
      deleteDraftTripUseCase,
      updateTripLiveTrackingUseCase,
    );
  });

  function buildUser(): CurrentUserContext {
    return {
      id: 'user-1',
      globalRole: GlobalUserRole.User,
      memberships: [],
    } as any;
  }

  it('calls createTripUseCase', async () => {
    createTripUseCase.execute.mockResolvedValue('created');
    const user = buildUser();
    const result = await controller.createTrip(user, { vehicleId: 'veh-1' } as any);
    expect(createTripUseCase.execute).toHaveBeenCalled();
    expect(result).toBe('created');
  });

  it('calls listTripsUseCase', async () => {
    listTripsUseCase.execute.mockResolvedValue('list');
    const user = buildUser();
    const result = await controller.listTrips(user, { mine: true } as any);
    expect(listTripsUseCase.execute).toHaveBeenCalled();
    expect(result).toBe('list');
  });

  it('calls listRecentTripRouteTemplatesUseCase', async () => {
    listRecentTripRouteTemplatesUseCase.execute.mockResolvedValue('templates');
    const user = buildUser();
    const result = await controller.listRecentTripRouteTemplates(user);
    expect(listRecentTripRouteTemplatesUseCase.execute).toHaveBeenCalledWith('user-1');
    expect(result).toBe('templates');
  });

  it('calls getTripByIdUseCase', async () => {
    getTripByIdUseCase.execute.mockResolvedValue('trip');
    const user = buildUser();
    const result = await controller.getTripById(user, 'trip-1');
    expect(getTripByIdUseCase.execute).toHaveBeenCalledWith('user-1', 'trip-1');
    expect(result).toBe('trip');
  });

  it('calls updateTripUseCase', async () => {
    updateTripUseCase.execute.mockResolvedValue('updated');
    const user = buildUser();
    const result = await controller.updateTrip(user, 'trip-1', { vehicleId: 'veh-2' } as any);
    expect(updateTripUseCase.execute).toHaveBeenCalled();
    expect(result).toBe('updated');
  });

  it('calls getTripLiveTrackingUseCase', async () => {
    getTripLiveTrackingUseCase.execute.mockResolvedValue('tracking');
    const user = buildUser();
    const result = await controller.getTripLiveTracking(user, 'trip-1');
    expect(getTripLiveTrackingUseCase.execute).toHaveBeenCalledWith('user-1', 'trip-1');
    expect(result).toBe('tracking');
  });

  it('calls publishTripUseCase', async () => {
    publishTripUseCase.execute.mockResolvedValue('published');
    const user = buildUser();
    const result = await controller.publishTrip(user, 'trip-1');
    expect(publishTripUseCase.execute).toHaveBeenCalledWith('user-1', 'trip-1');
    expect(result).toBe('published');
  });

  it('calls startTripUseCase', async () => {
    startTripUseCase.execute.mockResolvedValue('started');
    const user = buildUser();
    const result = await controller.startTrip(user, 'trip-1');
    expect(startTripUseCase.execute).toHaveBeenCalledWith('user-1', 'trip-1');
    expect(result).toBe('started');
  });

  it('calls completeTripUseCase', async () => {
    completeTripUseCase.execute.mockResolvedValue('completed');
    const user = buildUser();
    const result = await controller.completeTrip(user, 'trip-1', { closureNote: 'note' } as any);
    expect(completeTripUseCase.execute).toHaveBeenCalledWith('user-1', 'trip-1', 'note');
    expect(result).toBe('completed');
  });

  it('calls cancelTripUseCase', async () => {
    cancelTripUseCase.execute.mockResolvedValue('canceled');
    const user = buildUser();
    const result = await controller.cancelTrip(user, 'trip-1');
    expect(cancelTripUseCase.execute).toHaveBeenCalledWith('user-1', 'trip-1');
    expect(result).toBe('canceled');
  });

  it('calls deleteDraftTripUseCase', async () => {
    deleteDraftTripUseCase.execute.mockResolvedValue('deleted');
    const user = buildUser();
    const result = await controller.deleteDraftTrip(user, 'trip-1');
    expect(deleteDraftTripUseCase.execute).toHaveBeenCalledWith('user-1', 'trip-1');
    expect(result).toBe('deleted');
  });

  it('calls updateTripLiveTrackingUseCase', async () => {
    updateTripLiveTrackingUseCase.execute.mockResolvedValue('tracking-updated');
    const user = buildUser();
    const result = await controller.updateTripLiveTracking(user, 'trip-1', { latitude: 1, longitude: 2 } as any);
    expect(updateTripLiveTrackingUseCase.execute).toHaveBeenCalled();
    expect(result).toBe('tracking-updated');
  });
});
