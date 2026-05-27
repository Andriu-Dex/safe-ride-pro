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
import {
  INSTITUTIONS_REPOSITORY,
  InstitutionsRepository,
} from '../../../institutions/application/ports/institutions.repository';
import { NotificationsService } from '../../../notifications/application/services/notifications.service';
import { RealtimeEventsService } from '../../../realtime/application/services/realtime-events.service';
import { OperationalSanctionsService } from '../../../sanctions/application/services/operational-sanctions.service';
import {
  TRIP_REQUESTS_REPOSITORY,
  TripRequestsRepository,
  WALLET_INSUFFICIENT_BALANCE,
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
  acceptReservationCommitment: boolean;
};

@Injectable()
export class CreateTripRequestUseCase {
  constructor(
    @Inject(TRIP_REQUESTS_REPOSITORY)
    private readonly tripRequestsRepository: TripRequestsRepository,
    @Inject(INSTITUTIONS_REPOSITORY)
    private readonly institutionsRepository: InstitutionsRepository,
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

    if (
      !membership.termsAcceptedAt ||
      !membership.privacyAcceptedAt ||
      !membership.safetyRulesAcceptedAt
    ) {
      throw new ForbiddenException(
        'Debes completar la aceptacion de terminos, privacidad y seguridad desde tu perfil antes de solicitar viajes.',
      );
    }

    if (!command.acceptReservationCommitment) {
      throw new BadRequestException(
        'Debes aceptar las reglas minimas de seguridad y las condiciones de reserva antes de continuar.',
      );
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

    const institutionSettings = await this.institutionsRepository.getSettings(trip.institutionId);
    const selectedPaymentProvider = command.paymentProvider ?? PaymentProvider.Cash;

    if (
      selectedPaymentProvider === PaymentProvider.Cash &&
      !institutionSettings.allowCashPayments
    ) {
      throw new BadRequestException(
        'Esta institucion desactivo temporalmente el pago en efectivo para nuevas reservas.',
      );
    }

    if (
      selectedPaymentProvider === PaymentProvider.Paypal &&
      !institutionSettings.allowPaypalPayments
    ) {
      throw new BadRequestException(
        'Esta institucion desactivo temporalmente PayPal para nuevas reservas.',
      );
    }

    if (
      selectedPaymentProvider === PaymentProvider.Wallet &&
      !institutionSettings.allowWalletPayments
    ) {
      throw new BadRequestException(
        'Esta institucion desactivo temporalmente la billetera para nuevas reservas.',
      );
    }

    this.validateDetourPoints(trip.routeMode, command);

    const activeRequest = await this.tripRequestsRepository.findActiveRequestForTripAndPassenger(
      trip.id,
      membership.id,
    );

    if (activeRequest) {
      throw new BadRequestException('Ya tienes una solicitud activa para este viaje.');
    }

    const tripRequest = await this.createTripRequest(command, trip.id, membership.id, selectedPaymentProvider);

    if (tripRequest.payment?.provider === PaymentProvider.Paypal) {
      await this.notificationsService?.notifyMembership({
        institutionId: trip.institutionId,
        recipientMembershipId: membership.id,
        actorUserId: command.userId,
        type: AppNotificationType.PaymentActionRequired,
        title: 'Completa tu pago',
        body: 'Tu solicitud se enviara al conductor cuando PayPal confirme el pago.',
        actionUrl: '/viajes?passengerView=requests',
      });
    } else {
      this.realtimeEventsService.publishTripRequestChanged({
        actorUserId: command.userId,
        driverMembershipId: trip.driverMembershipId,
        institutionId: trip.institutionId,
        passengerMembershipId: tripRequest.passengerMembershipId,
        reason: 'created',
        requestId: tripRequest.id,
        tripId: trip.id,
      });

      await this.notificationsService?.notifyMembership({
        institutionId: trip.institutionId,
        recipientMembershipId: trip.driverMembershipId,
        actorUserId: command.userId,
        type: AppNotificationType.TripRequestCreated,
        title: 'Nueva solicitud de viaje',
        body: `${membership.fullName} quiere unirse a tu ruta.`,
        actionUrl: '/viajes/aprobar-solicitudes?experienceMode=driver',
      });
    }

    return {
      message:
        tripRequest.payment?.provider === PaymentProvider.Paypal
          ? 'Solicitud creada. Completa el pago para enviarla al conductor.'
          : tripRequest.payment?.provider === PaymentProvider.Wallet
            ? 'Solicitud enviada con saldo retenido.'
          : 'Solicitud enviada correctamente.',
      tripRequest,
    };
  }

  private async createTripRequest(
    command: CreateTripRequestCommand,
    tripId: string,
    passengerMembershipId: string,
    selectedPaymentProvider: PaymentProvider,
  ) {
    try {
      return await this.tripRequestsRepository.createTripRequest({
        tripId,
        passengerMembershipId,
        paymentProvider: selectedPaymentProvider,
        currencyCode: getAppEnvironment().paymentsCurrency,
        requestedPickupLatitude: command.requestedPickupLatitude,
        requestedPickupLongitude: command.requestedPickupLongitude,
        requestedDropoffLatitude: command.requestedDropoffLatitude,
        requestedDropoffLongitude: command.requestedDropoffLongitude,
        requestMessage: command.requestMessage?.trim() || undefined,
      });
    } catch (error) {
      if (error instanceof Error && error.message === WALLET_INSUFFICIENT_BALANCE) {
        throw new BadRequestException('Saldo insuficiente en la billetera.');
      }

      throw error;
    }
  }

  private validateDetourPoints(
    routeMode: TripRouteMode,
    command: CreateTripRequestCommand,
  ): void {
    this.validateCoordinatePair(
      command.requestedDropoffLatitude,
      command.requestedDropoffLongitude,
      'punto de destino',
    );

    const hasCustomPickup =
      command.requestedPickupLatitude !== undefined ||
      command.requestedPickupLongitude !== undefined;

    if (hasCustomPickup) {
      throw new BadRequestException(
        'El punto de recogida siempre corresponde a la institucion y no puede modificarse.',
      );
    }

    const hasCustomDropoff =
      command.requestedDropoffLatitude !== undefined ||
      command.requestedDropoffLongitude !== undefined;

    if (routeMode === TripRouteMode.DirectRoute && hasCustomDropoff) {
      throw new BadRequestException(
        'Esta ruta no admite desvio ni destinos personalizados.',
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
