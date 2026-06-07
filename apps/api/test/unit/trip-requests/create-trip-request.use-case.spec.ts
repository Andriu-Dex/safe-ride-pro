import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  MembershipStatus,
  PaymentProvider,
  TripPaymentStatus,
  TripRequestStatus,
  TripRouteMode,
  TripStatus,
} from '@saferidepro/shared-types';

import type { InstitutionsRepository } from '../../../src/modules/institutions/application/ports/institutions.repository';
import { OperationalSanctionsService } from '../../../src/modules/sanctions/application/services/operational-sanctions.service';
import { CreateTripRequestUseCase } from '../../../src/modules/trip-requests/application/use-cases/create-trip-request.use-case';
import {
  WALLET_INSUFFICIENT_BALANCE,
  type TripRequestsRepository,
} from '../../../src/modules/trip-requests/application/ports/trip-requests.repository';

function createTripRequestsRepositoryMock(): jest.Mocked<TripRequestsRepository> {
  return {
    findDefaultMembershipByUserId: jest.fn(),
    findTripById: jest.fn(),
    findTripRequestById: jest.fn(),
    findActiveRequestForTripAndPassenger: jest.fn(),
    createTripRequest: jest.fn(),
    listTripRequestsByPassengerMembershipId: jest.fn(),
    listTripRequestsByDriverMembershipId: jest.fn(),
    acceptTripRequest: jest.fn(),
    rejectTripRequest: jest.fn(),
    cancelTripRequest: jest.fn(),
    markTripRequestAsNoShow: jest.fn(),
    markTripRequestBoarded: jest.fn(),
    markTripRequestDroppedOff: jest.fn(),
  };
}

function createOperationalSanctionsServiceMock(): jest.Mocked<OperationalSanctionsService> {
  return {
    synchronizeAutomaticSanctions: jest.fn(),
    getRecentSanctionHistory: jest.fn(),
    assertPassengerOperationsAllowed: jest.fn(),
    assertDriverOperationsAllowed: jest.fn(),
  } as unknown as jest.Mocked<OperationalSanctionsService>;
}

function createInstitutionsRepositoryMock(): jest.Mocked<InstitutionsRepository> {
  return {
    listActive: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    updateStatus: jest.fn(),
    getSettings: jest.fn(),
    updateSettings: jest.fn(),
  };
}

describe('CreateTripRequestUseCase', () => {
  it('rejects when the user tries to request a trip owned by the same driver', async () => {
    const repository = createTripRequestsRepositoryMock();
    const institutionsRepository = createInstitutionsRepositoryMock();
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new CreateTripRequestUseCase(
      repository,
      institutionsRepository,
      sanctionsService,
    );

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-1',
      userId: 'user-1',
      fullName: 'Usuario Uno',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      termsAcceptedAt: new Date('2030-01-01T08:00:00.000Z'),
      privacyAcceptedAt: new Date('2030-01-01T08:00:00.000Z'),
      safetyRulesAcceptedAt: new Date('2030-01-01T08:00:00.000Z'),
    });

    repository.findTripById.mockResolvedValue({
      id: 'trip-1',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      driverMembershipId: 'membership-driver',
      driverUserId: 'user-1',
      driverFullName: 'Usuario Uno',
      status: TripStatus.Published,
      routeMode: TripRouteMode.DirectRoute,
      originLabel: 'Campus Huachi',
      destinationLabel: 'Centro',
      departureAt: new Date('2030-01-01T10:00:00.000Z'),
      estimatedArrivalAt: new Date('2030-01-01T10:30:00.000Z'),
      seatCount: 4,
      availableSeats: 3,
    });

    await expect(
      useCase.execute({
        userId: 'user-1',
        tripId: 'trip-1',
        acceptReservationCommitment: true,
      }),
    ).rejects.toThrow(new BadRequestException('No puedes solicitar un viaje propio.'));

    expect(repository.createTripRequest).not.toHaveBeenCalled();
  });

  it('rejects custom detour points for direct routes', async () => {
    const repository = createTripRequestsRepositoryMock();
    const institutionsRepository = createInstitutionsRepositoryMock();
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new CreateTripRequestUseCase(
      repository,
      institutionsRepository,
      sanctionsService,
    );

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-2',
      userId: 'user-2',
      fullName: 'Pasajero Dos',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      termsAcceptedAt: new Date('2030-01-01T08:00:00.000Z'),
      privacyAcceptedAt: new Date('2030-01-01T08:00:00.000Z'),
      safetyRulesAcceptedAt: new Date('2030-01-01T08:00:00.000Z'),
    });

    repository.findTripById.mockResolvedValue({
      id: 'trip-2',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      driverMembershipId: 'membership-driver',
      driverUserId: 'user-9',
      driverFullName: 'Conductor Nueve',
      status: TripStatus.Published,
      routeMode: TripRouteMode.DirectRoute,
      originLabel: 'Ficoa',
      destinationLabel: 'Izamba',
      departureAt: new Date('2030-01-01T10:00:00.000Z'),
      estimatedArrivalAt: new Date('2030-01-01T10:35:00.000Z'),
      seatCount: 4,
      availableSeats: 2,
    });
    repository.findActiveRequestForTripAndPassenger.mockResolvedValue(null);
    institutionsRepository.getSettings.mockResolvedValue({
      institutionId: 'institution-1',
      allowCashPayments: true,
      allowPaypalPayments: true,
      termsDocumentUrl: null,
      privacyPolicyUrl: null,
      safetyRulesTitle: 'Reglas',
      safetyRulesSummary: 'Resumen',
      safetyRulesBody: 'Detalle',
      createdAt: null,
      updatedAt: null,
    });

    await expect(
      useCase.execute({
        userId: 'user-2',
        tripId: 'trip-2',
        acceptReservationCommitment: true,
        requestedPickupLatitude: -1.23,
        requestedPickupLongitude: -78.61,
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'El punto de recogida siempre corresponde a la institucion y no puede modificarse.',
      ),
    );

    expect(repository.createTripRequest).not.toHaveBeenCalled();
  });

  it('blocks trip requests when the passenger has an active operational restriction', async () => {
    const repository = createTripRequestsRepositoryMock();
    const institutionsRepository = createInstitutionsRepositoryMock();
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new CreateTripRequestUseCase(
      repository,
      institutionsRepository,
      sanctionsService,
    );

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-2',
      userId: 'user-2',
      fullName: 'Pasajero Dos',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      termsAcceptedAt: new Date('2030-01-01T08:00:00.000Z'),
      privacyAcceptedAt: new Date('2030-01-01T08:00:00.000Z'),
      safetyRulesAcceptedAt: new Date('2030-01-01T08:00:00.000Z'),
    });
    sanctionsService.assertPassengerOperationsAllowed.mockRejectedValue(
      new ForbiddenException(
        'Tu membresia tiene una restriccion temporal para operar como pasajero hasta 01/01/2030.',
      ),
    );

    await expect(
      useCase.execute({
        userId: 'user-2',
        tripId: 'trip-2',
        acceptReservationCommitment: true,
      }),
    ).rejects.toThrow(
      new ForbiddenException(
        'Tu membresia tiene una restriccion temporal para operar como pasajero hasta 01/01/2030.',
      ),
    );

    expect(repository.findTripById).not.toHaveBeenCalled();
  });

  it('rejects requests when the visible reservation commitment is not accepted', async () => {
    const repository = createTripRequestsRepositoryMock();
    const institutionsRepository = createInstitutionsRepositoryMock();
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new CreateTripRequestUseCase(
      repository,
      institutionsRepository,
      sanctionsService,
    );

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-2',
      userId: 'user-2',
      fullName: 'Pasajero Dos',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      termsAcceptedAt: new Date('2030-01-01T08:00:00.000Z'),
      privacyAcceptedAt: new Date('2030-01-01T08:00:00.000Z'),
      safetyRulesAcceptedAt: new Date('2030-01-01T08:00:00.000Z'),
    });

    await expect(
      useCase.execute({
        userId: 'user-2',
        tripId: 'trip-2',
        acceptReservationCommitment: false,
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Debes aceptar las reglas minimas de seguridad y las condiciones de reserva antes de continuar.',
      ),
    );
  });

  it('rejects disabled payment methods from institutional settings', async () => {
    const repository = createTripRequestsRepositoryMock();
    const institutionsRepository = createInstitutionsRepositoryMock();
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new CreateTripRequestUseCase(
      repository,
      institutionsRepository,
      sanctionsService,
    );

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-2',
      userId: 'user-2',
      fullName: 'Pasajero Dos',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      termsAcceptedAt: new Date('2030-01-01T08:00:00.000Z'),
      privacyAcceptedAt: new Date('2030-01-01T08:00:00.000Z'),
      safetyRulesAcceptedAt: new Date('2030-01-01T08:00:00.000Z'),
    });
    repository.findTripById.mockResolvedValue({
      id: 'trip-2',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      driverMembershipId: 'membership-driver',
      driverUserId: 'user-9',
      driverFullName: 'Conductor Nueve',
      status: TripStatus.Published,
      routeMode: TripRouteMode.DirectRoute,
      originLabel: 'Ficoa',
      destinationLabel: 'Izamba',
      departureAt: new Date('2030-01-01T10:00:00.000Z'),
      estimatedArrivalAt: new Date('2030-01-01T10:35:00.000Z'),
      seatCount: 4,
      availableSeats: 2,
    });
    repository.findActiveRequestForTripAndPassenger.mockResolvedValue(null);
    institutionsRepository.getSettings.mockResolvedValue({
      institutionId: 'institution-1',
      allowCashPayments: true,
      allowPaypalPayments: false,
      termsDocumentUrl: null,
      privacyPolicyUrl: null,
      safetyRulesTitle: 'Reglas',
      safetyRulesSummary: 'Resumen',
      safetyRulesBody: 'Detalle',
      createdAt: null,
      updatedAt: null,
    });

    await expect(
      useCase.execute({
        userId: 'user-2',
        tripId: 'trip-2',
        acceptReservationCommitment: true,
        paymentProvider: PaymentProvider.Paypal,
      }),
    ).rejects.toThrow(
      new BadRequestException(
        'Esta institucion desactivo temporalmente PayPal para nuevas reservas.',
      ),
    );
  });

  it('creates a request with wallet balance when wallet payments are enabled', async () => {
    const repository = createTripRequestsRepositoryMock();
    const institutionsRepository = createInstitutionsRepositoryMock();
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new CreateTripRequestUseCase(
      repository,
      institutionsRepository,
      sanctionsService,
    );

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-2',
      userId: 'user-2',
      fullName: 'Pasajero Dos',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      termsAcceptedAt: new Date('2030-01-01T08:00:00.000Z'),
      privacyAcceptedAt: new Date('2030-01-01T08:00:00.000Z'),
      safetyRulesAcceptedAt: new Date('2030-01-01T08:00:00.000Z'),
    });
    repository.findTripById.mockResolvedValue({
      id: 'trip-2',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      driverMembershipId: 'membership-driver',
      driverUserId: 'user-9',
      driverFullName: 'Conductor Nueve',
      status: TripStatus.Published,
      routeMode: TripRouteMode.DirectRoute,
      originLabel: 'Ficoa',
      destinationLabel: 'Izamba',
      departureAt: new Date('2030-01-01T10:00:00.000Z'),
      estimatedArrivalAt: new Date('2030-01-01T10:35:00.000Z'),
      seatCount: 4,
      availableSeats: 2,
    });
    repository.findActiveRequestForTripAndPassenger.mockResolvedValue(null);
    institutionsRepository.getSettings.mockResolvedValue({
      institutionId: 'institution-1',
      allowCashPayments: true,
      allowPaypalPayments: true,
      allowWalletPayments: true,
      termsDocumentUrl: null,
      privacyPolicyUrl: null,
      safetyRulesTitle: 'Reglas',
      safetyRulesSummary: 'Resumen',
      safetyRulesBody: 'Detalle',
      createdAt: null,
      updatedAt: null,
    });
    repository.createTripRequest.mockResolvedValue({
      id: 'request-wallet-1',
      tripId: 'trip-2',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      driverMembershipId: 'membership-driver',
      driverUserId: 'user-9',
      driverFullName: 'Conductor Nueve',
      passengerMembershipId: 'membership-2',
      passengerUserId: 'user-2',
      passengerFullName: 'Pasajero Dos',
      status: TripRequestStatus.Pending,
      executionStatus: null,
      tripStatus: TripStatus.Published,
      tripRouteMode: TripRouteMode.DirectRoute,
      tripOriginLabel: 'Ficoa',
      tripOriginLatitude: null,
      tripOriginLongitude: null,
      tripDestinationLabel: 'Izamba',
      tripDestinationLatitude: null,
      tripDestinationLongitude: null,
      tripDepartureAt: new Date('2030-01-01T10:00:00.000Z'),
      tripEstimatedArrivalAt: new Date('2030-01-01T10:35:00.000Z'),
      tripCompletedAt: null,
      tripClosureNote: null,
      tripCancelledAt: null,
      tripSeatCount: 4,
      tripAvailableSeats: 2,
      requestedPickupLatitude: null,
      requestedPickupLongitude: null,
      requestedDropoffLatitude: null,
      requestedDropoffLongitude: null,
      requestMessage: null,
      reviewNote: null,
      executionStatusUpdatedAt: null,
      boardedAt: null,
      droppedOffAt: null,
      createdAt: new Date('2030-01-01T08:05:00.000Z'),
      reviewedAt: null,
      cancelledAt: null,
      cancellationTiming: null,
      payment: {
        id: 'payment-wallet-1',
        provider: PaymentProvider.Wallet,
        status: TripPaymentStatus.Paid,
        currencyCode: 'USD',
        amount: 4,
        checkoutUrl: null,
        paidAt: new Date('2030-01-01T08:05:00.000Z'),
        expiresAt: null,
        updatedAt: new Date('2030-01-01T08:05:00.000Z'),
      },
    });

    await expect(
      useCase.execute({
        userId: 'user-2',
        tripId: 'trip-2',
        acceptReservationCommitment: true,
        paymentProvider: PaymentProvider.Wallet,
      }),
    ).resolves.toMatchObject({
      message: 'Solicitud enviada con saldo retenido.',
      tripRequest: {
        payment: {
          provider: PaymentProvider.Wallet,
        },
      },
    });

    expect(repository.createTripRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        paymentProvider: PaymentProvider.Wallet,
      }),
    );
  });

  it('shows a clear error when wallet balance is insufficient', async () => {
    const repository = createTripRequestsRepositoryMock();
    const institutionsRepository = createInstitutionsRepositoryMock();
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new CreateTripRequestUseCase(
      repository,
      institutionsRepository,
      sanctionsService,
    );

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-2',
      userId: 'user-2',
      fullName: 'Pasajero Dos',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      termsAcceptedAt: new Date('2030-01-01T08:00:00.000Z'),
      privacyAcceptedAt: new Date('2030-01-01T08:00:00.000Z'),
      safetyRulesAcceptedAt: new Date('2030-01-01T08:00:00.000Z'),
    });
    repository.findTripById.mockResolvedValue({
      id: 'trip-2',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      driverMembershipId: 'membership-driver',
      driverUserId: 'user-9',
      driverFullName: 'Conductor Nueve',
      status: TripStatus.Published,
      routeMode: TripRouteMode.DirectRoute,
      originLabel: 'Ficoa',
      destinationLabel: 'Izamba',
      departureAt: new Date('2030-01-01T10:00:00.000Z'),
      estimatedArrivalAt: new Date('2030-01-01T10:35:00.000Z'),
      seatCount: 4,
      availableSeats: 2,
    });
    repository.findActiveRequestForTripAndPassenger.mockResolvedValue(null);
    institutionsRepository.getSettings.mockResolvedValue({
      institutionId: 'institution-1',
      allowCashPayments: true,
      allowPaypalPayments: true,
      allowWalletPayments: true,
      termsDocumentUrl: null,
      privacyPolicyUrl: null,
      safetyRulesTitle: 'Reglas',
      safetyRulesSummary: 'Resumen',
      safetyRulesBody: 'Detalle',
      createdAt: null,
      updatedAt: null,
    });
    repository.createTripRequest.mockRejectedValue(new Error(WALLET_INSUFFICIENT_BALANCE));

    await expect(
      useCase.execute({
        userId: 'user-2',
        tripId: 'trip-2',
        acceptReservationCommitment: true,
        paymentProvider: PaymentProvider.Wallet,
      }),
    ).rejects.toThrow(new BadRequestException('Saldo insuficiente en la billetera.'));
  });

  it('rejects inactive user memberships', async () => {
    const repository = createTripRequestsRepositoryMock();
    const institutionsRepository = createInstitutionsRepositoryMock();
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new CreateTripRequestUseCase(
      repository,
      institutionsRepository,
      sanctionsService,
    );

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-2',
      userId: 'user-2',
      fullName: 'Pasajero Dos',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Suspended,
      termsAcceptedAt: new Date('2030-01-01T08:00:00.000Z'),
      privacyAcceptedAt: new Date('2030-01-01T08:00:00.000Z'),
      safetyRulesAcceptedAt: new Date('2030-01-01T08:00:00.000Z'),
    });

    await expect(
      useCase.execute({
        userId: 'user-2',
        tripId: 'trip-2',
        acceptReservationCommitment: true,
      }),
    ).rejects.toThrow(new ForbiddenException('No tienes una membresia activa para solicitar viajes.'));
  });

  it('rejects when terms, privacy, or safety rules are not accepted', async () => {
    const repository = createTripRequestsRepositoryMock();
    const institutionsRepository = createInstitutionsRepositoryMock();
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new CreateTripRequestUseCase(
      repository,
      institutionsRepository,
      sanctionsService,
    );

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-2',
      userId: 'user-2',
      fullName: 'Pasajero Dos',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      termsAcceptedAt: null,
      privacyAcceptedAt: new Date(),
      safetyRulesAcceptedAt: new Date(),
    });

    await expect(
      useCase.execute({
        userId: 'user-2',
        tripId: 'trip-2',
        acceptReservationCommitment: true,
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects when the trip does not exist', async () => {
    const repository = createTripRequestsRepositoryMock();
    const institutionsRepository = createInstitutionsRepositoryMock();
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new CreateTripRequestUseCase(
      repository,
      institutionsRepository,
      sanctionsService,
    );

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-2',
      userId: 'user-2',
      fullName: 'Pasajero Dos',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      termsAcceptedAt: new Date(),
      privacyAcceptedAt: new Date(),
      safetyRulesAcceptedAt: new Date(),
    });
    repository.findTripById.mockResolvedValue(null);

    await expect(
      useCase.execute({
        userId: 'user-2',
        tripId: 'trip-2',
        acceptReservationCommitment: true,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects when the trip belongs to a different institution', async () => {
    const repository = createTripRequestsRepositoryMock();
    const institutionsRepository = createInstitutionsRepositoryMock();
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new CreateTripRequestUseCase(
      repository,
      institutionsRepository,
      sanctionsService,
    );

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-2',
      userId: 'user-2',
      fullName: 'Pasajero Dos',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      termsAcceptedAt: new Date(),
      privacyAcceptedAt: new Date(),
      safetyRulesAcceptedAt: new Date(),
    });
    repository.findTripById.mockResolvedValue({
      id: 'trip-2',
      institutionId: 'institution-other',
      institutionName: 'Other',
      driverMembershipId: 'membership-driver',
      driverUserId: 'user-9',
      driverFullName: 'Conductor Nueve',
      status: TripStatus.Published,
      routeMode: TripRouteMode.DirectRoute,
      originLabel: 'Ficoa',
      destinationLabel: 'Izamba',
      departureAt: new Date('2030-01-01T10:00:00.000Z'),
      estimatedArrivalAt: new Date('2030-01-01T10:35:00.000Z'),
      seatCount: 4,
      availableSeats: 2,
    });

    await expect(
      useCase.execute({
        userId: 'user-2',
        tripId: 'trip-2',
        acceptReservationCommitment: true,
      }),
    ).rejects.toThrow(new ForbiddenException('Solo puedes solicitar viajes de tu institucion activa.'));
  });

  it('rejects when trip status is not Published or seats < 1', async () => {
    const repository = createTripRequestsRepositoryMock();
    const institutionsRepository = createInstitutionsRepositoryMock();
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new CreateTripRequestUseCase(
      repository,
      institutionsRepository,
      sanctionsService,
    );

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-2',
      userId: 'user-2',
      fullName: 'Pasajero Dos',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      termsAcceptedAt: new Date(),
      privacyAcceptedAt: new Date(),
      safetyRulesAcceptedAt: new Date(),
    });
    repository.findTripById.mockResolvedValue({
      id: 'trip-2',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      driverMembershipId: 'membership-driver',
      driverUserId: 'user-9',
      driverFullName: 'Conductor Nueve',
      status: TripStatus.Draft,
      routeMode: TripRouteMode.DirectRoute,
      originLabel: 'Ficoa',
      destinationLabel: 'Izamba',
      departureAt: new Date('2030-01-01T10:00:00.000Z'),
      estimatedArrivalAt: new Date('2030-01-01T10:35:00.000Z'),
      seatCount: 4,
      availableSeats: 2,
    });

    await expect(
      useCase.execute({
        userId: 'user-2',
        tripId: 'trip-2',
        acceptReservationCommitment: true,
      }),
    ).rejects.toThrow(new BadRequestException('El viaje ya no tiene cupos disponibles.'));
  });

  it('rejects when trip departure is in the past', async () => {
    const repository = createTripRequestsRepositoryMock();
    const institutionsRepository = createInstitutionsRepositoryMock();
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new CreateTripRequestUseCase(
      repository,
      institutionsRepository,
      sanctionsService,
    );

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-2',
      userId: 'user-2',
      fullName: 'Pasajero Dos',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      termsAcceptedAt: new Date(),
      privacyAcceptedAt: new Date(),
      safetyRulesAcceptedAt: new Date(),
    });
    repository.findTripById.mockResolvedValue({
      id: 'trip-2',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      driverMembershipId: 'membership-driver',
      driverUserId: 'user-9',
      driverFullName: 'Conductor Nueve',
      status: TripStatus.Published,
      routeMode: TripRouteMode.DirectRoute,
      originLabel: 'Ficoa',
      destinationLabel: 'Izamba',
      departureAt: new Date('2020-01-01T10:00:00.000Z'),
      estimatedArrivalAt: new Date('2020-01-01T10:35:00.000Z'),
      seatCount: 4,
      availableSeats: 2,
    });

    await expect(
      useCase.execute({
        userId: 'user-2',
        tripId: 'trip-2',
        acceptReservationCommitment: true,
      }),
    ).rejects.toThrow(new BadRequestException('No puedes solicitar un viaje que ya esta por iniciar o salir.'));
  });

  it('rejects when Cash payments are disabled by institution settings', async () => {
    const repository = createTripRequestsRepositoryMock();
    const institutionsRepository = createInstitutionsRepositoryMock();
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new CreateTripRequestUseCase(
      repository,
      institutionsRepository,
      sanctionsService,
    );

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-2',
      userId: 'user-2',
      fullName: 'Pasajero Dos',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      termsAcceptedAt: new Date(),
      privacyAcceptedAt: new Date(),
      safetyRulesAcceptedAt: new Date(),
    });
    repository.findTripById.mockResolvedValue({
      id: 'trip-2',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      driverMembershipId: 'membership-driver',
      driverUserId: 'user-9',
      driverFullName: 'Conductor Nueve',
      status: TripStatus.Published,
      routeMode: TripRouteMode.DirectRoute,
      originLabel: 'Ficoa',
      destinationLabel: 'Izamba',
      departureAt: new Date('2030-01-01T10:00:00.000Z'),
      estimatedArrivalAt: new Date('2030-01-01T10:35:00.000Z'),
      seatCount: 4,
      availableSeats: 2,
    });
    repository.findActiveRequestForTripAndPassenger.mockResolvedValue(null);
    institutionsRepository.getSettings.mockResolvedValue({
      institutionId: 'institution-1',
      allowCashPayments: false,
      allowPaypalPayments: true,
    } as any);

    await expect(
      useCase.execute({
        userId: 'user-2',
        tripId: 'trip-2',
        acceptReservationCommitment: true,
        paymentProvider: PaymentProvider.Cash,
      }),
    ).rejects.toThrow(new BadRequestException('Esta institucion desactivo temporalmente el pago en efectivo para nuevas reservas.'));
  });

  it('rejects when Wallet payments are disabled by institution settings', async () => {
    const repository = createTripRequestsRepositoryMock();
    const institutionsRepository = createInstitutionsRepositoryMock();
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new CreateTripRequestUseCase(
      repository,
      institutionsRepository,
      sanctionsService,
    );

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-2',
      userId: 'user-2',
      fullName: 'Pasajero Dos',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      termsAcceptedAt: new Date(),
      privacyAcceptedAt: new Date(),
      safetyRulesAcceptedAt: new Date(),
    });
    repository.findTripById.mockResolvedValue({
      id: 'trip-2',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      driverMembershipId: 'membership-driver',
      driverUserId: 'user-9',
      driverFullName: 'Conductor Nueve',
      status: TripStatus.Published,
      routeMode: TripRouteMode.DirectRoute,
      originLabel: 'Ficoa',
      destinationLabel: 'Izamba',
      departureAt: new Date('2030-01-01T10:00:00.000Z'),
      estimatedArrivalAt: new Date('2030-01-01T10:35:00.000Z'),
      seatCount: 4,
      availableSeats: 2,
    });
    repository.findActiveRequestForTripAndPassenger.mockResolvedValue(null);
    institutionsRepository.getSettings.mockResolvedValue({
      institutionId: 'institution-1',
      allowCashPayments: true,
      allowPaypalPayments: true,
      allowWalletPayments: false,
    } as any);

    await expect(
      useCase.execute({
        userId: 'user-2',
        tripId: 'trip-2',
        acceptReservationCommitment: true,
        paymentProvider: PaymentProvider.Wallet,
      }),
    ).rejects.toThrow(new BadRequestException('Esta institucion desactivo temporalmente la billetera para nuevas reservas.'));
  });

  it('rejects when passenger already has an active request for this trip', async () => {
    const repository = createTripRequestsRepositoryMock();
    const institutionsRepository = createInstitutionsRepositoryMock();
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new CreateTripRequestUseCase(
      repository,
      institutionsRepository,
      sanctionsService,
    );

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-2',
      userId: 'user-2',
      fullName: 'Pasajero Dos',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      termsAcceptedAt: new Date(),
      privacyAcceptedAt: new Date(),
      safetyRulesAcceptedAt: new Date(),
    });
    repository.findTripById.mockResolvedValue({
      id: 'trip-2',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      driverMembershipId: 'membership-driver',
      driverUserId: 'user-9',
      driverFullName: 'Conductor Nueve',
      status: TripStatus.Published,
      routeMode: TripRouteMode.DirectRoute,
      originLabel: 'Ficoa',
      destinationLabel: 'Izamba',
      departureAt: new Date('2030-01-01T10:00:00.000Z'),
      estimatedArrivalAt: new Date('2030-01-01T10:35:00.000Z'),
      seatCount: 4,
      availableSeats: 2,
    });
    repository.findActiveRequestForTripAndPassenger.mockResolvedValue({ id: 'request-active' } as any);
    institutionsRepository.getSettings.mockResolvedValue({
      institutionId: 'institution-1',
      allowCashPayments: true,
      allowPaypalPayments: true,
    } as any);

    await expect(
      useCase.execute({
        userId: 'user-2',
        tripId: 'trip-2',
        acceptReservationCommitment: true,
      }),
    ).rejects.toThrow(new BadRequestException('Ya tienes una solicitud activa para este viaje.'));
  });

  it('handles PayPal payment request creation successfully', async () => {
    const repository = createTripRequestsRepositoryMock();
    const institutionsRepository = createInstitutionsRepositoryMock();
    const sanctionsService = createOperationalSanctionsServiceMock();
    const notificationsService = { notifyMembership: jest.fn() } as any;
    const useCase = new CreateTripRequestUseCase(
      repository,
      institutionsRepository,
      sanctionsService,
      undefined,
      notificationsService,
    );

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-2',
      userId: 'user-2',
      fullName: 'Pasajero Dos',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      termsAcceptedAt: new Date(),
      privacyAcceptedAt: new Date(),
      safetyRulesAcceptedAt: new Date(),
    });
    repository.findTripById.mockResolvedValue({
      id: 'trip-2',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      driverMembershipId: 'membership-driver',
      driverUserId: 'user-9',
      driverFullName: 'Conductor Nueve',
      status: TripStatus.Published,
      routeMode: TripRouteMode.DirectRoute,
      originLabel: 'Ficoa',
      destinationLabel: 'Izamba',
      departureAt: new Date('2030-01-01T10:00:00.000Z'),
      estimatedArrivalAt: new Date('2030-01-01T10:35:00.000Z'),
      seatCount: 4,
      availableSeats: 2,
    });
    repository.findActiveRequestForTripAndPassenger.mockResolvedValue(null);
    institutionsRepository.getSettings.mockResolvedValue({
      institutionId: 'institution-1',
      allowCashPayments: true,
      allowPaypalPayments: true,
    } as any);
    repository.createTripRequest.mockResolvedValue({
      id: 'request-paypal-1',
      passengerMembershipId: 'membership-2',
      payment: {
        provider: PaymentProvider.Paypal,
      },
    } as any);

    const result = await useCase.execute({
      userId: 'user-2',
      tripId: 'trip-2',
      acceptReservationCommitment: true,
      paymentProvider: PaymentProvider.Paypal,
    });

    expect(result.message).toBe('Solicitud creada. Completa el pago para enviarla al conductor.');
    expect(notificationsService.notifyMembership).toHaveBeenCalled();
  });

  it('propagates other errors from repository during trip request creation', async () => {
    const repository = createTripRequestsRepositoryMock();
    const institutionsRepository = createInstitutionsRepositoryMock();
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new CreateTripRequestUseCase(
      repository,
      institutionsRepository,
      sanctionsService,
    );

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-2',
      userId: 'user-2',
      fullName: 'Pasajero Dos',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      termsAcceptedAt: new Date(),
      privacyAcceptedAt: new Date(),
      safetyRulesAcceptedAt: new Date(),
    });
    repository.findTripById.mockResolvedValue({
      id: 'trip-2',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      driverMembershipId: 'membership-driver',
      driverUserId: 'user-9',
      driverFullName: 'Conductor Nueve',
      status: TripStatus.Published,
      routeMode: TripRouteMode.DirectRoute,
      originLabel: 'Ficoa',
      destinationLabel: 'Izamba',
      departureAt: new Date('2030-01-01T10:00:00.000Z'),
      estimatedArrivalAt: new Date('2030-01-01T10:35:00.000Z'),
      seatCount: 4,
      availableSeats: 2,
    });
    repository.findActiveRequestForTripAndPassenger.mockResolvedValue(null);
    institutionsRepository.getSettings.mockResolvedValue({
      institutionId: 'institution-1',
      allowCashPayments: true,
      allowPaypalPayments: true,
    } as any);
    repository.createTripRequest.mockRejectedValue(new Error('Prisma error'));

    await expect(
      useCase.execute({
        userId: 'user-2',
        tripId: 'trip-2',
        acceptReservationCommitment: true,
      }),
    ).rejects.toThrow('Prisma error');
  });

  it('rejects coordinate pair mismatch and custom dropoff for DirectRoute', async () => {
    const repository = createTripRequestsRepositoryMock();
    const institutionsRepository = createInstitutionsRepositoryMock();
    const sanctionsService = createOperationalSanctionsServiceMock();
    const useCase = new CreateTripRequestUseCase(
      repository,
      institutionsRepository,
      sanctionsService,
    );

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-2',
      userId: 'user-2',
      fullName: 'Pasajero Dos',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      termsAcceptedAt: new Date(),
      privacyAcceptedAt: new Date(),
      safetyRulesAcceptedAt: new Date(),
    });
    repository.findTripById.mockResolvedValue({
      id: 'trip-2',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      driverMembershipId: 'membership-driver',
      driverUserId: 'user-9',
      driverFullName: 'Conductor Nueve',
      status: TripStatus.Published,
      routeMode: TripRouteMode.DirectRoute,
      originLabel: 'Ficoa',
      destinationLabel: 'Izamba',
      departureAt: new Date('2030-01-01T10:00:00.000Z'),
      estimatedArrivalAt: new Date('2030-01-01T10:35:00.000Z'),
      seatCount: 4,
      availableSeats: 2,
    });
    repository.findActiveRequestForTripAndPassenger.mockResolvedValue(null);
    institutionsRepository.getSettings.mockResolvedValue({
      institutionId: 'institution-1',
      allowCashPayments: true,
    } as any);

    await expect(
      useCase.execute({
        userId: 'user-2',
        tripId: 'trip-2',
        acceptReservationCommitment: true,
        requestedDropoffLatitude: -1.23,
      }),
    ).rejects.toThrow(new BadRequestException('Debes enviar latitud y longitud completas para el punto de destino.'));

    await expect(
      useCase.execute({
        userId: 'user-2',
        tripId: 'trip-2',
        acceptReservationCommitment: true,
        requestedDropoffLatitude: -1.23,
        requestedDropoffLongitude: -78.65,
      }),
    ).rejects.toThrow(new BadRequestException('Esta ruta no admite desvio ni destinos personalizados.'));
  });

  it('returns success message when payment provider is Cash or payment info is absent', async () => {
    const repository = createTripRequestsRepositoryMock();
    const institutionsRepository = createInstitutionsRepositoryMock();
    const sanctionsService = createOperationalSanctionsServiceMock();
    const realtimeEventsService = { publishTripRequestChanged: jest.fn() } as any;
    const notificationsService = { notifyMembership: jest.fn() } as any;
    const useCase = new CreateTripRequestUseCase(
      repository,
      institutionsRepository,
      sanctionsService,
      realtimeEventsService,
      notificationsService,
    );

    repository.findDefaultMembershipByUserId.mockResolvedValue({
      id: 'membership-2',
      userId: 'user-2',
      fullName: 'Pasajero Dos',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      membershipStatus: MembershipStatus.Active,
      termsAcceptedAt: new Date(),
      privacyAcceptedAt: new Date(),
      safetyRulesAcceptedAt: new Date(),
    });
    repository.findTripById.mockResolvedValue({
      id: 'trip-2',
      institutionId: 'institution-1',
      institutionName: 'UTA',
      driverMembershipId: 'membership-driver',
      driverUserId: 'user-9',
      driverFullName: 'Conductor Nueve',
      status: TripStatus.Published,
      routeMode: TripRouteMode.DirectRoute,
      originLabel: 'Ficoa',
      destinationLabel: 'Izamba',
      departureAt: new Date('2030-01-01T10:00:00.000Z'),
      estimatedArrivalAt: new Date('2030-01-01T10:35:00.000Z'),
      seatCount: 4,
      availableSeats: 2,
    });
    repository.findActiveRequestForTripAndPassenger.mockResolvedValue(null);
    institutionsRepository.getSettings.mockResolvedValue({
      institutionId: 'institution-1',
      allowCashPayments: true,
    } as any);
    repository.createTripRequest.mockResolvedValue({
      id: 'request-cash-1',
      passengerMembershipId: 'membership-2',
      payment: null,
    } as any);

    const result = await useCase.execute({
      userId: 'user-2',
      tripId: 'trip-2',
      acceptReservationCommitment: true,
      paymentProvider: PaymentProvider.Cash,
    });

    expect(result.message).toBe('Solicitud enviada correctamente.');
    expect(notificationsService.notifyMembership).toHaveBeenCalled();
  });
});
