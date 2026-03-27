import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AccountStatus, GlobalUserRole } from '@saferidepro/shared-types';

import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import { CurrentUserContext } from '../../application/types/current-user-context.type';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<{ headers: { authorization?: string }; user?: CurrentUserContext }>();
    const token = this.extractToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('A bearer token is required.');
    }

    let payload: { sub: string };

    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('The access token is invalid.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        memberships: {
          include: {
            institution: true,
          },
          orderBy: {
            joinedAt: 'asc',
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('The access token user does not exist.');
    }

    if (user.accountStatus === 'SUSPENDED') {
      throw new UnauthorizedException('The account is suspended.');
    }

    request.user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      globalRole: user.globalRole as unknown as GlobalUserRole,
      accountStatus: user.accountStatus as unknown as AccountStatus,
      memberships: user.memberships.map((membership) => ({
        id: membership.id,
        institutionId: membership.institutionId,
        institutionName: membership.institution.name,
        role: membership.role as never,
        membershipStatus: membership.membershipStatus as never,
        studentCode: membership.studentCode,
        isDefault: membership.isDefault,
        driverVerificationStatus: membership.driverVerificationStatus as never,
      })),
    };

    return true;
  }

  private extractToken(authorizationHeader?: string): string | null {
    if (!authorizationHeader) {
      return null;
    }

    const [type, token] = authorizationHeader.split(' ');

    return type === 'Bearer' && token ? token : null;
  }
}
