import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { CurrentUserContext } from '../../../modules/auth/application/types/current-user-context.type';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentUserContext => {
    const request = context.switchToHttp().getRequest<{ user: CurrentUserContext }>();

    return request.user;
  },
);
