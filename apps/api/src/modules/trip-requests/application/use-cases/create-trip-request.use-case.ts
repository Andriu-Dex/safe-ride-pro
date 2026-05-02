import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  AppNotificationType,
  MembershipStatus,
  PaymentProvider,
  TripRouteMode,
  TripStatus,
} from '@saferidepro/shared-types';

import { getAppEnvironment } from '../../../../shared/infrastructure/config/app-environment';
import { NotificationsService } from '../../../notifications/application/services/notifications.service';
import { RealtimeEventsService } from '../../../realtime/application/services/realtime-events.service';
import { OperationalSanctionsService } from '../../../sanctions/application/services/operational-sanctions.service';
import {
  TRIP_REQUESTS_REPOSITORY,
  TripRequestsRepository,
} from '../ports/trip-requests.repository';

export type CreateTripRequestCommand = {
  userId: string;
  tripId: string;
  requestedPickupLatitude?: number;
  requestedPickupLongitude?: number;
  requestedDropoffLatitude?: number;
  requestedDropoffLongitude?: number;
  requestMessage?: string;
  paymentProvider?: PaymentProvider;
};

@Injectable()
export class CreateTripRequestUseCase {
  constructor(
    @Inject(TRIP_REQUESTS_REPOSITORY)
    private readonly tripRequestsRepository: TripRequestsRepository,
    private readonly operationalSanctionsService: OperationalSanctionsService,
    @Optional()
    private readonly realtimeEventsService: RealtimeEventsService = new RealtimeEventsService(),
    @Optional()
    private readonly notificationsService?: NotificationsService,
  ) {}

  async execute(command: CreateTripRequestCommand) {
    const membership = await this.tripRequestsRepository.findDefaultMembershipByUserId(command.userId);

    if (!membership || membership.membershipStatus !== MembershipStatus.Active) {
      throw new ForbiddenException('No tienes una membresia activa para solicitar viajes.');
    }

    await this.operationalSanctionsService.assertPassengerOperationsAllowed(membership.id);

    const trip = await this.tripRequestsRepository.findTripById(command.tripId);

    if (!trip) {
      throw new NotFoundException('El viaje solicitado no existe.');
    }

    if (trip.institutionId !== membership.institutionId) {
      throw new ForbiddenException('Solo puedes solicitar viajes de tu institucion activa.');
    }

    if (trip.driverUserId === membership.userId) {
      throw new BadRequestException('No puedes solicitar un viaje propio.');
    }

    if (trip.status !== TripStatus.Published || trip.availableSeats < 1) {
      throw new BadRequestException('El viaje ya no tiene cupos disponibles.');
    }

    if (trip.departureAt <= new Date()) {
      throw new BadRequestException('No puedes solicitar un viaje que ya esta por iniciar o salir.');
    }

    this.validateDetourPoints(trip.routeMode, command);

    const activeRequest = await this.tripRequestsRepository.findActiveRequestForTripAndPassenger(
      trip.id,
      membership.id,
    );

    if (activeRequest) {
      throw new BadRequestException('Ya tienes una solicitud activa para este viaje.');
    }

    const tripRequest = await this.tripRequestsRepository.createTripRequest({
      tripId: trip.id,
      passengerMembershipId: membership.id,
      paymentProvider: command.paymentProvider ?? PaymentProvider.Cash,
      currencyCode: getAppEnvironment().paymentsCurrency,
      requestedPickupLatitude: command.requestedPickupLatitude,
      requestedPickupLongitude: command.requestedPickupLongitude,
      requestedDropoffLatitude: command.requestedDropoffLatitude,
      requestedDropoffLongitude: command.requestedDropoffLongitude,
      requestMessage: command.requestMessage?.trim() || undefined,
    });

    this.realtimeEventsService.publishTripRequestChanged({
      actorUserId: command.userId,
      driverMembershipId: trip.driverMembershipId,
      institutionId: trip.institutionId,
      passengerMembershipId: tripRequest.passengerMembershipId,
      reason: 'created',
      requestId: tripRequest.id,
      tripId: trip.id,
    });

    if (tripRequest.payment?.provider === PaymentProvider.Paypal) {
      await this.notificationsService?.notifyMembership({
        institutionId: trip.institutionId,
        recipientMembershipId: membership.id,
        actorUserId: command.userId,
        type: AppNotificationType.PaymentActionRequired,
        title: 'Completa tu pago',
        body: 'Tu solicitud se enviara al conductor cuando PayPal confirme el pago.',
        actionUrl: '/viajes',
      });
    } else {
      await this.notificationsService?.notifyMembership({
        institutionId: trip.institutionId,
        recipientMembershipId: trip.driverMembershipId,
        actorUserId: command.userId,
        type: AppNotificationType.TripRequestCreated,
        title: 'Nueva solicitud de viaje',
        body: `${membership.fullName} quiere unirse a tu ruta.`,
        actionUrl: '/viajes',
      });
    }

    return {
      message:
        tripRequest.payment?.provider === PaymentProvider.Paypal
          ? 'Solicitud creada. Completa el pago para enviarla al conductor.'
          : 'Solicitud enviada correctamente.',
      tripRequest,
    };
  }

  private validateDetourPoints(
    routeMode: TripRouteMode,
    command: CreateTripRequestCommand,
  ): void {
    this.validateCoordinatePair(
      command.requestedPickupLatitude,
      command.requestedPickupLongitude,
      'punto de recogida',
    );
    this.validateCoordinatePair(
      command.requestedDropoffLatitude,
      command.requestedDropoffLongitude,
      'punto de destino',
    );

    const hasCustomPoints =
      command.requestedPickupLatitude !== undefined ||
      command.requestedPickupLongitude !== undefined ||
      command.requestedDropoffLatitude !== undefined ||
      command.requestedDropoffLongitude !== undefined;

    if (routeMode === TripRouteMode.DirectRoute && hasCustomPoints) {
      throw new BadRequestException(
        'Las rutas directas no admiten puntos personalizados de recogida o destino.',
      );
    }
  }

  private validateCoordinatePair(
    latitude: number | undefined,
    longitude: number | undefined,
    pointName: string,
  ): void {
    const hasLatitude = latitude !== undefined;
    const hasLongitude = longitude !== undefined;

    if (hasLatitude !== hasLongitude) {
      throw new BadRequestException(
        `Debes enviar latitud y longitud completas para el ${pointName}.`,
      );
    }
  }
}
