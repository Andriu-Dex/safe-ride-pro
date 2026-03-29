import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { GlobalUserRole } from '@saferidepro/shared-types';

import { CurrentUserContext } from '../../application/types/current-user-context.type';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user: CurrentUserContext }>();

    if (request.user.globalRole !== GlobalUserRole.SuperAdmin) {
      throw new ForbiddenException('Esta accion requiere privilegios de SUPER_ADMIN.');
    }

    return true;
  }
}
