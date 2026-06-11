import { SanctionsController } from '../../../src/modules/sanctions/presentation/controllers/sanctions.controller';
import { CurrentUserContext } from '../../../src/modules/auth/application/types/current-user-context.type';
import { GlobalUserRole } from '@saferidepro/shared-types';

describe('SanctionsController', () => {
  let controller: SanctionsController;
  let listMySanctionAppealsUseCaseMock: any;
  let submitSanctionAppealUseCaseMock: any;
  let listReviewableSanctionAppealsUseCaseMock: any;
  let reviewSanctionAppealUseCaseMock: any;
  let listReviewableActiveSanctionsUseCaseMock: any;
  let liftOperationalSanctionUseCaseMock: any;

  beforeEach(() => {
    listMySanctionAppealsUseCaseMock = { execute: jest.fn() };
    submitSanctionAppealUseCaseMock = { execute: jest.fn() };
    listReviewableSanctionAppealsUseCaseMock = { execute: jest.fn() };
    reviewSanctionAppealUseCaseMock = { execute: jest.fn() };
    listReviewableActiveSanctionsUseCaseMock = { execute: jest.fn() };
    liftOperationalSanctionUseCaseMock = { execute: jest.fn() };

    controller = new SanctionsController(
      listMySanctionAppealsUseCaseMock,
      submitSanctionAppealUseCaseMock,
      listReviewableSanctionAppealsUseCaseMock,
      reviewSanctionAppealUseCaseMock,
      listReviewableActiveSanctionsUseCaseMock,
      liftOperationalSanctionUseCaseMock,
    );
  });

  function buildUser(): CurrentUserContext {
    return {
      id: 'user-1',
      globalRole: GlobalUserRole.User,
      memberships: [],
    } as any;
  }

  it('calls listMySanctionAppealsUseCase (covers line 41)', async () => {
    listMySanctionAppealsUseCaseMock.execute.mockResolvedValue('list-appeals');
    const user = buildUser();
    const result = await controller.listMyAppeals(user);
    expect(listMySanctionAppealsUseCaseMock.execute).toHaveBeenCalledWith(user);
    expect(result).toBe('list-appeals');
  });

  it('calls submitSanctionAppealUseCase (covers line 50)', async () => {
    submitSanctionAppealUseCaseMock.execute.mockResolvedValue('submitted');
    const user = buildUser();
    const result = await controller.submitAppeal(user, 'sanction-1', { reason: 'Test reason' });
    expect(submitSanctionAppealUseCaseMock.execute).toHaveBeenCalledWith(user, { sanctionId: 'sanction-1', reason: 'Test reason' });
    expect(result).toBe('submitted');
  });

  it('calls listReviewableSanctionAppealsUseCase (covers line 61)', async () => {
    listReviewableSanctionAppealsUseCaseMock.execute.mockResolvedValue('reviewable-appeals');
    const user = buildUser();
    const result = await controller.listReviewableAppeals(user, { institutionId: 'inst-1', status: 'PENDING' as any, limit: 10 });
    expect(listReviewableSanctionAppealsUseCaseMock.execute).toHaveBeenCalledWith({ currentUser: user, institutionId: 'inst-1', status: 'PENDING', limit: 10 });
    expect(result).toBe('reviewable-appeals');
  });

  it('calls reviewSanctionAppealUseCase (covers line 75)', async () => {
    reviewSanctionAppealUseCaseMock.execute.mockResolvedValue('reviewed');
    const user = buildUser();
    const result = await controller.reviewAppeal(user, 'appeal-1', { status: 'APPROVED' as any, reviewNote: 'note' });
    expect(reviewSanctionAppealUseCaseMock.execute).toHaveBeenCalledWith(user, { appealId: 'appeal-1', status: 'APPROVED', reviewNote: 'note' });
    expect(result).toBe('reviewed');
  });

  it('calls listReviewableActiveSanctionsUseCase (covers line 88)', async () => {
    listReviewableActiveSanctionsUseCaseMock.execute.mockResolvedValue('active-sanctions');
    const user = buildUser();
    const result = await controller.listReviewableActiveSanctions(user, { institutionId: 'inst-1', userId: 'user-2', limit: 5 });
    expect(listReviewableActiveSanctionsUseCaseMock.execute).toHaveBeenCalledWith({ currentUser: user, institutionId: 'inst-1', userId: 'user-2', limit: 5 });
    expect(result).toBe('active-sanctions');
  });

  it('calls liftOperationalSanctionUseCase (covers line 101)', async () => {
    liftOperationalSanctionUseCaseMock.execute.mockResolvedValue('lifted');
    const user = buildUser();
    const result = await controller.liftSanction(user, 'sanction-1', { reviewNote: 'ok' });
    expect(liftOperationalSanctionUseCaseMock.execute).toHaveBeenCalledWith(user, { sanctionId: 'sanction-1', reviewNote: 'ok' });
    expect(result).toBe('lifted');
  });
});
