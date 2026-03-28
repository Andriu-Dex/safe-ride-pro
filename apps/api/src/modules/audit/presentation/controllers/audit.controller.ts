import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { CurrentUser } from '../../../../shared/presentation/decorators/current-user.decorator';
import { CurrentUserContext } from '../../../auth/application/types/current-user-context.type';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { ListAuditEventsUseCase } from '../../application/use-cases/list-audit-events.use-case';
import { ListAuditEventsQueryDto } from '../dto/list-audit-events.query.dto';

@Controller('audit')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly listAuditEventsUseCase: ListAuditEventsUseCase) {}

  @Get('events')
  listEvents(
    @CurrentUser() currentUser: CurrentUserContext,
    @Query() query: ListAuditEventsQueryDto,
  ) {
    return this.listAuditEventsUseCase.execute({
      currentUser,
      institutionId: query.institutionId,
      actorUserId: query.actorUserId,
      action: query.action,
      entityType: query.entityType,
      from: query.from,
      to: query.to,
      limit: query.limit,
    });
  }
}