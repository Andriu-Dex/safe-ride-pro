import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../../../../shared/presentation/decorators/current-user.decorator';
import { CurrentUserContext } from '../../../auth/application/types/current-user-context.type';
import { JwtAuthGuard } from '../../../auth/presentation/guards/jwt-auth.guard';
import { CancelTripUseCase } from '../../application/use-cases/cancel-trip.use-case';
import { CompleteTripUseCase } from '../../application/use-cases/complete-trip.use-case';
import { CreateTripUseCase } from '../../application/use-cases/create-trip.use-case';
import { DeleteDraftTripUseCase } from '../../application/use-cases/delete-draft-trip.use-case';
import { GetTripByIdUseCase } from '../../application/use-cases/get-trip-by-id.use-case';
import { ListRecentTripRouteTemplatesUseCase } from '../../application/use-cases/list-recent-trip-route-templates.use-case';
import { GetTripLiveTrackingUseCase } from '../../application/use-cases/get-trip-live-tracking.use-case';
import { ListTripsUseCase } from '../../application/use-cases/list-trips.use-case';
import { PublishTripUseCase } from '../../application/use-cases/publish-trip.use-case';
import { StartTripUseCase } from '../../application/use-cases/start-trip.use-case';
import { UpdateTripUseCase } from '../../application/use-cases/update-trip.use-case';
import { UpdateTripLiveTrackingUseCase } from '../../application/use-cases/update-trip-live-tracking.use-case';
import { CompleteTripRequestDto } from '../dto/complete-trip.request.dto';
import { CreateTripRequestDto } from '../dto/create-trip.request.dto';
import { ListTripsQueryDto } from '../dto/list-trips.query.dto';
import { UpdateTripRequestDto } from '../dto/update-trip.request.dto';
import { UpdateTripLiveTrackingRequestDto } from '../dto/update-trip-live-tracking.request.dto';

@Controller('trips')
@UseGuards(JwtAuthGuard)
export class TripsController {
  constructor(
    private readonly createTripUseCase: CreateTripUseCase,
    private readonly listTripsUseCase: ListTripsUseCase,
    private readonly getTripByIdUseCase: GetTripByIdUseCase,
    private readonly listRecentTripRouteTemplatesUseCase: ListRecentTripRouteTemplatesUseCase,
    private readonly getTripLiveTrackingUseCase: GetTripLiveTrackingUseCase,
    private readonly publishTripUseCase: PublishTripUseCase,
    private readonly startTripUseCase: StartTripUseCase,
    private readonly updateTripUseCase: UpdateTripUseCase,
    private readonly completeTripUseCase: CompleteTripUseCase,
    private readonly cancelTripUseCase: CancelTripUseCase,
    private readonly deleteDraftTripUseCase: DeleteDraftTripUseCase,
    private readonly updateTripLiveTrackingUseCase: UpdateTripLiveTrackingUseCase,
  ) {}

  @Post()
  createTrip(
    @CurrentUser() currentUser: CurrentUserContext,
    @Body() body: CreateTripRequestDto,
  ) {
    return this.createTripUseCase.execute({
      userId: currentUser.id,
      vehicleId: body.vehicleId,
      routeMode: body.routeMode,
      originLabel: body.originLabel,
      destinationLabel: body.destinationLabel,
      originLatitude: body.originLatitude,
      originLongitude: body.originLongitude,
      destinationLatitude: body.destinationLatitude,
      destinationLongitude: body.destinationLongitude,
      departureAt: body.departureAt,
      estimatedArrivalAt: body.estimatedArrivalAt,
      seatCount: body.seatCount,
      basePriceReference: body.basePriceReference,
      detourSurchargeReference: body.detourSurchargeReference,
      notes: body.notes,
    });
  }

  @Get()
  listTrips(
    @CurrentUser() currentUser: CurrentUserContext,
    @Query() query: ListTripsQueryDto,
  ) {
    return this.listTripsUseCase.execute({
      userId: currentUser.id,
      mine: query.mine,
      origin: query.origin,
      destination: query.destination,
      dateFrom: query.dateFrom,
      dateTo: query.dateTo,
      timeFrom: query.timeFrom,
      timeTo: query.timeTo,
      routeMode: query.routeMode,
      vehicleType: query.vehicleType,
      availability: query.availability,
    });
  }

  @Get('templates/recent')
  listRecentTripRouteTemplates(@CurrentUser() currentUser: CurrentUserContext) {
    return this.listRecentTripRouteTemplatesUseCase.execute(currentUser.id);
  }

  @Get(':tripId')
  getTripById(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('tripId') tripId: string,
  ) {
    return this.getTripByIdUseCase.execute(currentUser.id, tripId);
  }

  @Patch(':tripId')
  updateTrip(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('tripId') tripId: string,
    @Body() body: UpdateTripRequestDto,
  ) {
    return this.updateTripUseCase.execute({
      userId: currentUser.id,
      tripId,
      vehicleId: body.vehicleId,
      routeMode: body.routeMode,
      originLabel: body.originLabel,
      destinationLabel: body.destinationLabel,
      originLatitude: body.originLatitude,
      originLongitude: body.originLongitude,
      destinationLatitude: body.destinationLatitude,
      destinationLongitude: body.destinationLongitude,
      departureAt: body.departureAt,
      estimatedArrivalAt: body.estimatedArrivalAt,
      seatCount: body.seatCount,
      basePriceReference: body.basePriceReference,
      detourSurchargeReference: body.detourSurchargeReference,
      notes: body.notes,
    });
  }

  @Get(':tripId/live-tracking')
  getTripLiveTracking(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('tripId') tripId: string,
  ) {
    return this.getTripLiveTrackingUseCase.execute(currentUser.id, tripId);
  }

  @Patch(':tripId/publish')
  publishTrip(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('tripId') tripId: string,
  ) {
    return this.publishTripUseCase.execute(currentUser.id, tripId);
  }

  @Patch(':tripId/start')
  startTrip(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('tripId') tripId: string,
  ) {
    return this.startTripUseCase.execute(currentUser.id, tripId);
  }

  @Patch(':tripId/complete')
  completeTrip(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('tripId') tripId: string,
    @Body() body: CompleteTripRequestDto,
  ) {
    return this.completeTripUseCase.execute(currentUser.id, tripId, body.closureNote);
  }

  @Patch(':tripId/cancel')
  cancelTrip(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('tripId') tripId: string,
  ) {
    return this.cancelTripUseCase.execute(currentUser.id, tripId);
  }

  @Delete(':tripId')
  deleteDraftTrip(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('tripId') tripId: string,
  ) {
    return this.deleteDraftTripUseCase.execute(currentUser.id, tripId);
  }

  @Post(':tripId/live-tracking/positions')
  updateTripLiveTracking(
    @CurrentUser() currentUser: CurrentUserContext,
    @Param('tripId') tripId: string,
    @Body() body: UpdateTripLiveTrackingRequestDto,
  ) {
    return this.updateTripLiveTrackingUseCase.execute({
      userId: currentUser.id,
      tripId,
      capturedAt: body.capturedAt,
      latitude: body.latitude,
      longitude: body.longitude,
      accuracyMeters: body.accuracyMeters,
      headingDegrees: body.headingDegrees,
      speedKph: body.speedKph,
    });
  }
}
