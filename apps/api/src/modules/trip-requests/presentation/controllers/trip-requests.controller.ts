import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../../../../shared/presentation/decorators/current-user.decorator';
import { CurrentUserContext } from '../../../auth/application/types/current-user-context.type';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { AcceptTripRequestUseCase } from '../../application/use-cases/accept-trip-request.use-case';
import { CancelTripRequestUseCase } from '../../application/use-cases/cancel-trip-request.use-case';
import { CreateTripRequestUseCase } from '../../application/use-cases/create-trip-request.use-case';
import { ListDriverTripRequestsUseCase } from '../../application/use-cases/list-driver-trip-requests.use-case';
import { ListMyTripRequestsUseCase } from '../../application/use-cases/list-my-trip-requests.use-case';
import { MarkTripRequestBoardedUseCase } from '../../application/use-cases/mark-trip-request-boarded.use-case';
import { MarkTripRequestDroppedOffUseCase } from '../../application/use-cases/mark-trip-request-dropped-off.use-case';
import { MarkTripRequestNoShowUseCase } from '../../application/use-cases/mark-trip-request-no-show.use-case';
import { RejectTripRequestUseCase } from '../../application/use-cases/reject-trip-request.use-case';
import { CreateTripRequestRequestDto } from '../dto/create-trip-request.request.dto';
import { ReviewTripRequestRequestDto } from '../dto/review-trip-request.request.dto';

@Controller('trip-requests')
@UseGuards(JwtAuthGuard)
export class TripRequestsController {
  constructor(
    private readonly createTripRequestUseCase: CreateTripRequestUseCase,
    private readonly listMyTripRequestsUseCase: ListMyTripRequestsUseCase,
    private readonly listDriverTripRequestsUseCase: ListDriverTripRequestsUseCase,
    private readonly acceptTripRequestUseCase: AcceptTripRequestUseCase,
    private readonly rejectTripRequestUseCase: RejectTripRequestUseCase,
    private readonly cancelTripRequestUseCase: CancelTripRequestUseCase,
    private readonly markTripRequestBoardedUseCase: MarkTripRequestBoardedUseCase,
    private readonly markTripRequestDroppedOffUseCase: MarkTripRequestDroppedOffUseCase,
    private readonly markTripRequestNoShowUseCase: MarkTripRequestNoShowUseCase,
  ) {}

  @Post()
  createTripRequest(
    @CurrentUser() currentUser: CurrentUserContext,
    @Body() body: CreateTripRequestRequestDto,
  ) {
    return this.createTripRequestUseCase.execute({
      userId: currentUser.id,
      tripId: body.tripId,
      requestedPickupLatitude: body.requestedPickupLatitude,
      requestedPickupLongitude: body.requestedPickupLongitude,
      requestedDropoffLatitude: body.requestedDropoffLatitude,
      requestedDropoffLongitude: body.requestedDropoffLongitude,
      requestMessage: body.requestMessage,
      paymentProvider: body.paymentProvider,
      acceptReservationCommitment: body.acceptReservationCommitment,
    });
  }

  @Get('me')
  listMyTripRequests(@CurrentUser() currentUser: CurrentUserContext) {
    return this.listMyTripRequestsUseCase.execute(currentUser.id);
  }

  @Get('driver')
  listDriverTripRequests(@CurrentUser() currentUser: CurrentUserContext) {
    return this.listDriverTripRequestsUseCase.execute(currentUser.id);
  }

  @Patch(':requestId/accept')
  acceptTripRequest(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
    @Body() body: ReviewTripRequestRequestDto,
  ) {
    return this.acceptTripRequestUseCase.execute(currentUser.id, requestId, body.reviewNote);
  }

  @Patch(':requestId/reject')
  rejectTripRequest(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
    @Body() body: ReviewTripRequestRequestDto,
  ) {
    return this.rejectTripRequestUseCase.execute(currentUser.id, requestId, body.reviewNote);
  }

  @Patch(':requestId/cancel')
  cancelTripRequest(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
  ) {
    return this.cancelTripRequestUseCase.execute(currentUser.id, requestId);
  }

  @Patch(':requestId/boarded')
  markTripRequestBoarded(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
  ) {
    return this.markTripRequestBoardedUseCase.execute(currentUser.id, requestId);
  }

  @Patch(':requestId/dropped-off')
  markTripRequestDroppedOff(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
  ) {
    return this.markTripRequestDroppedOffUseCase.execute(currentUser.id, requestId);
  }

  @Patch(':requestId/no-show')
  markTripRequestNoShow(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('requestId', new ParseUUIDPipe()) requestId: string,
    @Body() body: ReviewTripRequestRequestDto,
  ) {
    return this.markTripRequestNoShowUseCase.execute(
      currentUser.id,
      requestId,
      body.reviewNote,
    );
  }
}
