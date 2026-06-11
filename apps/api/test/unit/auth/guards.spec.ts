import { UnauthorizedException, ForbiddenException, ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { GlobalUserRole, AccountStatus, DriverVerificationStatus, InstitutionMembershipRole, MembershipStatus } from '@saferidepro/shared-types';

import { JwtAuthGuard } from '../../../src/modules/auth/presentation/guards/jwt-auth.guard';
import { SuperAdminGuard } from '../../../src/modules/auth/presentation/guards/super-admin.guard';
import { PrismaService } from '../../../src/shared/infrastructure/database/prisma.service';

describe('Guards Verification', () => {
  describe('JwtAuthGuard', () => {
    let guard: JwtAuthGuard;
    let jwtServiceMock: jest.Mocked<JwtService>;
    let prismaServiceMock: any;

    beforeEach(() => {
      jwtServiceMock = {
        verifyAsync: jest.fn(),
      } as any;

      prismaServiceMock = {
        user: {
          findUnique: jest.fn(),
        },
      };

      guard = new JwtAuthGuard(jwtServiceMock, prismaServiceMock);
    });

    function createMockExecutionContext(authorizationHeader?: string): ExecutionContext {
      const req = {
        headers: {
          authorization: authorizationHeader,
        },
        user: null as any,
      };

      return {
        switchToHttp: () => ({
          getRequest: () => req,
        }),
      } as any;
    }

    it('debe permitir la activacion si se provee un token JWT Bearer valido y el usuario esta activo', async () => {
      const context = createMockExecutionContext('Bearer valid_token');
      jwtServiceMock.verifyAsync.mockResolvedValue({ sub: 'user-id-123' });

      const mockDbUser = {
        id: 'user-id-123',
        email: 'student@uta.edu.ec',
        fullName: 'Steven Paredes',
        globalRole: GlobalUserRole.User,
        accountStatus: AccountStatus.Active,
        memberships: [
          {
            id: 'membership-id-123',
            institutionId: 'inst-id-456',
            role: InstitutionMembershipRole.Student,
            membershipStatus: MembershipStatus.Active,
            studentCode: '1804561239',
            isDefault: true,
            driverVerificationStatus: DriverVerificationStatus.NotRequested,
            driverProfile: null,
            institution: {
              name: 'Universidad Tecnica de Ambato',
              isActive: true,
            },
          },
        ],
      };

      prismaServiceMock.user.findUnique.mockResolvedValue(mockDbUser);

      const canActivate = await guard.canActivate(context);
      expect(canActivate).toBe(true);

      const request = context.switchToHttp().getRequest();
      expect(request.user).toBeDefined();
      expect(request.user.id).toBe('user-id-123');
      expect(request.user.email).toBe('student@uta.edu.ec');
      expect(request.user.globalRole).toBe(GlobalUserRole.User);
      expect(request.user.accountStatus).toBe(AccountStatus.Active);
    });

    it('debe lanzar UnauthorizedException si no se envia la cabecera de autorizacion', async () => {
      const context = createMockExecutionContext(undefined);
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('debe lanzar UnauthorizedException si la cabecera de autorizacion no tiene el formato Bearer', async () => {
      const context = createMockExecutionContext('Basic custom_token');
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('debe lanzar UnauthorizedException si la verificacion del token JWT falla', async () => {
      const context = createMockExecutionContext('Bearer invalid_token');
      jwtServiceMock.verifyAsync.mockRejectedValue(new Error('JWT expirado'));

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('debe lanzar UnauthorizedException si el usuario asociado al token no existe en base de datos', async () => {
      const context = createMockExecutionContext('Bearer valid_token');
      jwtServiceMock.verifyAsync.mockResolvedValue({ sub: 'non-existing-user' });
      prismaServiceMock.user.findUnique.mockResolvedValue(null);

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('debe lanzar UnauthorizedException si el usuario de la base de datos esta suspendido', async () => {
      const context = createMockExecutionContext('Bearer valid_token');
      jwtServiceMock.verifyAsync.mockResolvedValue({ sub: 'user-suspended' });

      const mockDbUser = {
        id: 'user-suspended',
        email: 'suspended@uta.edu.ec',
        fullName: 'Usuario Suspendido',
        globalRole: GlobalUserRole.User,
        accountStatus: AccountStatus.Suspended,
        memberships: [],
      };
      prismaServiceMock.user.findUnique.mockResolvedValue(mockDbUser);

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('SuperAdminGuard', () => {
    let guard: SuperAdminGuard;

    beforeEach(() => {
      guard = new SuperAdminGuard();
    });

    function createMockExecutionContextWithRole(role: GlobalUserRole): ExecutionContext {
      const req = {
        user: {
          globalRole: role,
        },
      };

      return {
        switchToHttp: () => ({
          getRequest: () => req,
        }),
      } as any;
    }

    it('debe permitir la activacion si el usuario tiene el rol de SuperAdmin', () => {
      const context = createMockExecutionContextWithRole(GlobalUserRole.SuperAdmin);
      const canActivate = guard.canActivate(context);
      expect(canActivate).toBe(true);
    });

    it('debe lanzar ForbiddenException si el usuario tiene un rol regular de User', () => {
      const context = createMockExecutionContextWithRole(GlobalUserRole.User);
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });
});
