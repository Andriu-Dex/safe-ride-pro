import { UsersController } from '../../../src/modules/users/presentation/controllers/users.controller';
import { CurrentUserContext } from '../../../src/modules/auth/application/types/current-user-context.type';
import { GlobalUserRole } from '@saferidepro/shared-types';

describe('UsersController', () => {
  let controller: UsersController;
  let getCurrentUserUseCase: any;
  let listAdminUserDirectoryUseCase: any;
  let getCurrentUserTrustSummaryUseCase: any;
  let updateCurrentUserUseCase: any;
  let updateAdminUserAccountStatusUseCase: any;
  let uploadCurrentUserProfilePhotoUseCase: any;

  beforeEach(() => {
    getCurrentUserUseCase = { execute: jest.fn() };
    listAdminUserDirectoryUseCase = { execute: jest.fn() };
    getCurrentUserTrustSummaryUseCase = { execute: jest.fn() };
    updateCurrentUserUseCase = { execute: jest.fn() };
    updateAdminUserAccountStatusUseCase = { execute: jest.fn() };
    uploadCurrentUserProfilePhotoUseCase = { execute: jest.fn() };

    controller = new UsersController(
      getCurrentUserUseCase,
      listAdminUserDirectoryUseCase,
      getCurrentUserTrustSummaryUseCase,
      updateCurrentUserUseCase,
      updateAdminUserAccountStatusUseCase,
      uploadCurrentUserProfilePhotoUseCase,
    );
  });

  function buildUser(): CurrentUserContext {
    return {
      id: 'user-1',
      globalRole: GlobalUserRole.User,
      memberships: [],
    } as any;
  }

  it('calls updateCurrentUserUseCase (covers line 90)', async () => {
    updateCurrentUserUseCase.execute.mockResolvedValue('updated');
    const user = buildUser();
    const result = await controller.updateCurrentUser(user, {} as any);
    expect(updateCurrentUserUseCase.execute).toHaveBeenCalledWith('user-1', {});
    expect(result).toBe('updated');
  });
});
