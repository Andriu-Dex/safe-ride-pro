import { Controller, Get, Req, Res, UseGuards } from '@nestjs/common';
import type { IncomingMessage, ServerResponse } from 'node:http';

import { CurrentUser } from '../../../../shared/presentation/decorators/current-user.decorator';
import { CurrentUserContext } from '../../../auth/application/types/current-user-context.type';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { RealtimeEventsService } from '../../application/services/realtime-events.service';

@Controller('realtime')
@UseGuards(JwtAuthGuard)
export class RealtimeController {
  constructor(private readonly realtimeEventsService: RealtimeEventsService) {}

  @Get('stream')
  openStream(
    @CurrentUser() currentUser: CurrentUserContext,
    @Req() request: IncomingMessage,
    @Res() response: ServerResponse<IncomingMessage>,
  ): void {
    this.realtimeEventsService.openStream(currentUser, request, response);
  }
}
