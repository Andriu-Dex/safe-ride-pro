import { TripRequestsController } from '../../../src/modules/trip-requests/presentation/controllers/trip-requests.controller';
import { CurrentUserContext } from '../../../src/modules/auth/application/types/current-user-context.type';
import { GlobalUserRole } from '@saferidepro/shared-types';

describe('TripRequestsController', () => {
  let controller: TripRequestsController;
  let createTripRequestUseCase: any;
  let listMyTripRequestsUseCase: any;
  let listDriverTripRequestsUseCase: any;
  let acceptTripRequestUseCase: any;
  let rejectTripRequestUseCase: any;
  let cancelTripRequestUseCase: any;
  let markTripRequestBoardedUseCase: any;
  let markTripRequestDroppedOffUseCase: any;
  let markTripRequestNoShowUseCase: any;

  beforeEach(() => {
    createTripRequestUseCase = { execute: jest.fn() };
    listMyTripRequestsUseCase = { execute: jest.fn() };
    listDriverTripRequestsUseCase = { execute: jest.fn() };
    acceptTripRequestUseCase = { execute: jest.fn() };
    rejectTripRequestUseCase = { execute: jest.fn() };
    cancelTripRequestUseCase = { execute: jest.fn() };
    markTripRequestBoardedUseCase = { execute: jest.fn() };
    markTripRequestDroppedOffUseCase = { execute: jest.fn() };
    markTripRequestNoShowUseCase = { execute: jest.fn() };

    controller = new TripRequestsController(
      createTripRequestUseCase,
      listMyTripRequestsUseCase,
      listDriverTripRequestsUseCase,
      acceptTripRequestUseCase,
      rejectTripRequestUseCase,
      cancelTripRequestUseCase,
      markTripRequestBoardedUseCase,
      markTripRequestDroppedOffUseCase,
      markTripRequestNoShowUseCase,
    );
  });

  function buildUser(): CurrentUserContext {
    return {
      id: 'user-1',
      globalRole: GlobalUserRole.User,
      memberships: [],
    } as any;
  }

  it('calls createTripRequestUseCase', async () => {
    createTripRequestUseCase.execute.mockResolvedValue('created');
    const user = buildUser();
    const result = await controller.createTripRequest(user, { tripId: 'trip-1' } as any);
    expect(createTripRequestUseCase.execute).toHaveBeenCalled();
    expect(result).toBe('created');
  });

  it('calls listMyTripRequestsUseCase', async () => {
    listMyTripRequestsUseCase.execute.mockResolvedValue('list');
    const user = buildUser();
    const result = await controller.listMyTripRequests(user);
    expect(listMyTripRequestsUseCase.execute).toHaveBeenCalledWith('user-1');
    expect(result).toBe('list');
  });

  it('calls listDriverTripRequestsUseCase', async () => {
    listDriverTripRequestsUseCase.execute.mockResolvedValue('list-driver');
    const user = buildUser();
    const result = await controller.listDriverTripRequests(user);
    expect(listDriverTripRequestsUseCase.execute).toHaveBeenCalledWith('user-1');
    expect(result).toBe('list-driver');
  });

  it('calls acceptTripRequestUseCase', async () => {
    acceptTripRequestUseCase.execute.mockResolvedValue('accepted');
    const user = buildUser();
    const result = await controller.acceptTripRequest(user, 'req-1', { reviewNote: 'ok' });
    expect(acceptTripRequestUseCase.execute).toHaveBeenCalledWith('user-1', 'req-1', 'ok');
    expect(result).toBe('accepted');
  });

  it('calls rejectTripRequestUseCase', async () => {
    rejectTripRequestUseCase.execute.mockResolvedValue('rejected');
    const user = buildUser();
    const result = await controller.rejectTripRequest(user, 'req-1', { reviewNote: 'no' });
    expect(rejectTripRequestUseCase.execute).toHaveBeenCalledWith('user-1', 'req-1', 'no');
    expect(result).toBe('rejected');
  });

  it('calls cancelTripRequestUseCase', async () => {
    cancelTripRequestUseCase.execute.mockResolvedValue('canceled');
    const user = buildUser();
    const result = await controller.cancelTripRequest(user, 'req-1');
    expect(cancelTripRequestUseCase.execute).toHaveBeenCalledWith('user-1', 'req-1');
    expect(result).toBe('canceled');
  });

  it('calls markTripRequestBoardedUseCase', async () => {
    markTripRequestBoardedUseCase.execute.mockResolvedValue('boarded');
    const user = buildUser();
    const result = await controller.markTripRequestBoarded(user, 'req-1');
    expect(markTripRequestBoardedUseCase.execute).toHaveBeenCalledWith('user-1', 'req-1');
    expect(result).toBe('boarded');
  });

  it('calls markTripRequestDroppedOffUseCase', async () => {
    markTripRequestDroppedOffUseCase.execute.mockResolvedValue('dropped-off');
    const user = buildUser();
    const result = await controller.markTripRequestDroppedOff(user, 'req-1');
    expect(markTripRequestDroppedOffUseCase.execute).toHaveBeenCalledWith('user-1', 'req-1');
    expect(result).toBe('dropped-off');
  });

  it('calls markTripRequestNoShowUseCase', async () => {
    markTripRequestNoShowUseCase.execute.mockResolvedValue('no-show');
    const user = buildUser();
    const result = await controller.markTripRequestNoShow(user, 'req-1', { reviewNote: 'no show' });
    expect(markTripRequestNoShowUseCase.execute).toHaveBeenCalledWith('user-1', 'req-1', 'no show');
    expect(result).toBe('no-show');
  });
});
