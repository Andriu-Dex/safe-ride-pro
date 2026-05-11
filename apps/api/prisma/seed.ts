import { hash } from 'bcryptjs';
import {
  AccountStatus,
  AppNotificationType,
  AssetStorageProvider,
  AuditAction,
  AuditEntityType,
  DocumentType,
  DriverVerificationStatus,
  GlobalUserRole,
  LuggagePolicy,
  MembershipRole,
  MembershipStatus,
  OperationalSanctionAppealStatus,
  OperationalSanctionScope,
  OperationalSanctionStatus,
  OperationalSanctionTrigger,
  OperationalSanctionType,
  PaymentProvider,
  Prisma,
  PrismaClient,
  ReportStatus,
  TripLiveTrackingStatus,
  TripRequestExecutionStatus,
  TripRequestStatus,
  TripRouteMode,
  TripStatus,
  VehicleType,
} from '@prisma/client';

const prisma = new PrismaClient();

const institutionSeed = {
  id: 'seed-inst-uta',
  name: process.env.DEFAULT_INSTITUTION_NAME ?? 'Universidad Tecnica de Ambato',
  code: process.env.DEFAULT_INSTITUTION_CODE ?? 'UTA',
  domain: process.env.DEFAULT_INSTITUTION_DOMAIN ?? 'uta.edu.ec',
} as const;

const superAdminSeed = {
  id: 'seed-user-admin',
  email: process.env.SUPER_ADMIN_EMAIL ?? 'admin@uta.edu.ec',
  password: process.env.SUPER_ADMIN_PASSWORD ?? 'Admin12345',
  fullName: process.env.SUPER_ADMIN_FULL_NAME ?? 'SafeRidePro Super Admin',
  documentType:
    (process.env.SUPER_ADMIN_DOCUMENT_TYPE as DocumentType | undefined) ?? DocumentType.NATIONAL_ID,
  documentNumber: process.env.SUPER_ADMIN_DOCUMENT_NUMBER ?? '0000000000',
  membershipId: 'seed-membership-admin',
  studentCode: 'ADMIN-001',
} as const;

const qaUserSeeds = {
  passenger: {
    id: 'seed-user-passenger',
    email: 'pasajero@uta.edu.ec',
    password: 'Passenger123!',
    fullName: 'Andrea Pasajera',
    phone: '0991111111',
    career: 'Ingenieria en Software',
    referenceNeighborhood: 'Ficoa',
    documentNumber: '1710034065',
    membershipId: 'seed-membership-passenger',
    studentCode: 'STU-1001',
  },
  passengerTwo: {
    id: 'seed-user-passenger-2',
    email: 'pasajero2@uta.edu.ec',
    password: 'Passenger123!',
    fullName: 'Carlos Pasajero',
    phone: '0992222222',
    career: 'Ingenieria Industrial',
    referenceNeighborhood: 'Huachi Chico',
    documentNumber: '1718137159',
    membershipId: 'seed-membership-passenger-2',
    studentCode: 'STU-1002',
  },
  driverApproved: {
    id: 'seed-user-driver-approved',
    email: 'conductor@uta.edu.ec',
    password: 'Driver123!',
    fullName: 'Daniel Conductor',
    phone: '0993333333',
    career: 'Ingenieria Automotriz',
    referenceNeighborhood: 'Atocha',
    documentNumber: '1719249722',
    membershipId: 'seed-membership-driver-approved',
    studentCode: 'DRV-2001',
  },
  driverPending: {
    id: 'seed-user-driver-pending',
    email: 'conductor-pendiente@uta.edu.ec',
    password: 'Driver123!',
    fullName: 'Paula Conductor',
    phone: '0994444444',
    career: 'Ingenieria Civil',
    referenceNeighborhood: 'Izamba',
    documentNumber: '1721182148',
    membershipId: 'seed-membership-driver-pending',
    studentCode: 'DRV-2002',
  },
} as const;

const staticIds = {
  settings: 'seed-settings-uta',
  approvedDriverProfile: 'seed-driver-profile-approved',
  pendingDriverProfile: 'seed-driver-profile-pending',
  approvedVehicle: 'seed-vehicle-approved',
  tripPublished: 'seed-trip-published',
  tripDraft: 'seed-trip-draft',
  tripCompleted: 'seed-trip-completed',
  tripInProgress: 'seed-trip-in-progress',
  trackingInProgress: 'seed-tracking-in-progress',
  trackingPointOne: 'seed-tracking-point-1',
  trackingPointTwo: 'seed-tracking-point-2',
  requestPending: 'seed-request-pending',
  requestAccepted: 'seed-request-accepted',
  requestRejected: 'seed-request-rejected',
  requestCompleted: 'seed-request-completed',
  paymentAccepted: 'seed-payment-accepted',
  paymentCompleted: 'seed-payment-completed',
  ratingPassengerToDriver: 'seed-rating-passenger-driver',
  ratingDriverToPassenger: 'seed-rating-driver-passenger',
  reportCompleted: 'seed-report-completed',
  sanctionPassenger: 'seed-sanction-passenger',
  appealPassenger: 'seed-appeal-passenger',
  notificationDriverRequest: 'seed-notification-driver-request',
  notificationPassengerAccepted: 'seed-notification-passenger-accepted',
} as const;

const licenseTypeSeeds = [
  { code: 'A', name: 'Licencia tipo A' },
  { code: 'B', name: 'Licencia tipo B' },
  { code: 'C', name: 'Licencia tipo C' },
] as const;

const vehicleCatalogSeeds = [
  {
    brand: 'Toyota',
    models: [
      { name: 'Corolla', vehicleType: VehicleType.CAR },
      { name: 'Yaris', vehicleType: VehicleType.CAR },
      { name: 'Prius', vehicleType: VehicleType.CAR },
      { name: 'RAV4', vehicleType: VehicleType.CAR },
      { name: 'Hilux', vehicleType: VehicleType.PICKUP_TRUCK },
    ],
  },
  {
    brand: 'Chevrolet',
    models: [
      { name: 'Aveo', vehicleType: VehicleType.CAR },
      { name: 'Onix', vehicleType: VehicleType.CAR },
      { name: 'Sail', vehicleType: VehicleType.CAR },
      { name: 'D-Max', vehicleType: VehicleType.PICKUP_TRUCK },
    ],
  },
  {
    brand: 'Kia',
    models: [
      { name: 'Rio', vehicleType: VehicleType.CAR },
      { name: 'Soluto', vehicleType: VehicleType.CAR },
      { name: 'Sportage', vehicleType: VehicleType.CAR },
    ],
  },
  {
    brand: 'Hyundai',
    models: [
      { name: 'Accent', vehicleType: VehicleType.CAR },
      { name: 'Grand i10', vehicleType: VehicleType.CAR },
      { name: 'Tucson', vehicleType: VehicleType.CAR },
    ],
  },
  {
    brand: 'Nissan',
    models: [
      { name: 'Versa', vehicleType: VehicleType.CAR },
      { name: 'Sentra', vehicleType: VehicleType.CAR },
      { name: 'Kicks', vehicleType: VehicleType.CAR },
      { name: 'Frontier', vehicleType: VehicleType.PICKUP_TRUCK },
    ],
  },
  {
    brand: 'Mazda',
    models: [
      { name: 'Mazda2', vehicleType: VehicleType.CAR },
      { name: 'Mazda3', vehicleType: VehicleType.CAR },
      { name: 'CX-5', vehicleType: VehicleType.CAR },
      { name: 'BT-50', vehicleType: VehicleType.PICKUP_TRUCK },
    ],
  },
  {
    brand: 'Suzuki',
    models: [
      { name: 'Swift', vehicleType: VehicleType.CAR },
      { name: 'Dzire', vehicleType: VehicleType.CAR },
      { name: 'Vitara', vehicleType: VehicleType.CAR },
    ],
  },
  {
    brand: 'Renault',
    models: [
      { name: 'Logan', vehicleType: VehicleType.CAR },
      { name: 'Sandero', vehicleType: VehicleType.CAR },
      { name: 'Duster', vehicleType: VehicleType.CAR },
      { name: 'Oroch', vehicleType: VehicleType.PICKUP_TRUCK },
    ],
  },
  {
    brand: 'Volkswagen',
    models: [
      { name: 'Gol', vehicleType: VehicleType.CAR },
      { name: 'Virtus', vehicleType: VehicleType.CAR },
      { name: 'Jetta', vehicleType: VehicleType.CAR },
      { name: 'Amarok', vehicleType: VehicleType.PICKUP_TRUCK },
    ],
  },
  {
    brand: 'Ford',
    models: [
      { name: 'Fiesta', vehicleType: VehicleType.CAR },
      { name: 'Focus', vehicleType: VehicleType.CAR },
      { name: 'Escape', vehicleType: VehicleType.CAR },
      { name: 'Ranger', vehicleType: VehicleType.PICKUP_TRUCK },
    ],
  },
  {
    brand: 'Mitsubishi',
    models: [
      { name: 'Lancer', vehicleType: VehicleType.CAR },
      { name: 'ASX', vehicleType: VehicleType.CAR },
      { name: 'L200', vehicleType: VehicleType.PICKUP_TRUCK },
    ],
  },
  {
    brand: 'Honda',
    models: [
      { name: 'Civic', vehicleType: VehicleType.CAR },
      { name: 'City', vehicleType: VehicleType.CAR },
      { name: 'CR-V', vehicleType: VehicleType.CAR },
      { name: 'CB125F', vehicleType: VehicleType.MOTORCYCLE },
      { name: 'CB190R', vehicleType: VehicleType.MOTORCYCLE },
      { name: 'XR150L', vehicleType: VehicleType.MOTORCYCLE },
    ],
  },
  {
    brand: 'Yamaha',
    models: [
      { name: 'MT-03', vehicleType: VehicleType.MOTORCYCLE },
      { name: 'FZ-S', vehicleType: VehicleType.MOTORCYCLE },
      { name: 'XTZ150', vehicleType: VehicleType.MOTORCYCLE },
      { name: 'YBR125', vehicleType: VehicleType.MOTORCYCLE },
    ],
  },
  {
    brand: 'Bajaj',
    models: [
      { name: 'Discover 125 ST', vehicleType: VehicleType.MOTORCYCLE },
      { name: 'Pulsar NS160', vehicleType: VehicleType.MOTORCYCLE },
      { name: 'Pulsar N250', vehicleType: VehicleType.MOTORCYCLE },
    ],
  },
  {
    brand: 'Shineray',
    models: [
      { name: 'XY150-5', vehicleType: VehicleType.MOTORCYCLE },
      { name: 'Phoenix 200', vehicleType: VehicleType.MOTORCYCLE },
    ],
  },
  {
    brand: 'JAC',
    models: [
      { name: 'S2', vehicleType: VehicleType.CAR },
      { name: 'S3', vehicleType: VehicleType.CAR },
      { name: 'T8', vehicleType: VehicleType.PICKUP_TRUCK },
    ],
  },
  {
    brand: 'Chery',
    models: [
      { name: 'Arrizo 5', vehicleType: VehicleType.CAR },
      { name: 'Tiggo 2', vehicleType: VehicleType.CAR },
      { name: 'Tiggo 7', vehicleType: VehicleType.CAR },
    ],
  },
  {
    brand: 'Great Wall',
    models: [
      { name: 'Wingle 5', vehicleType: VehicleType.PICKUP_TRUCK },
      { name: 'Poer', vehicleType: VehicleType.PICKUP_TRUCK },
    ],
  },
] as const;

async function seedCatalogs(): Promise<void> {
  for (const licenseTypeSeed of licenseTypeSeeds) {
    await prisma.licenseType.upsert({
      where: { code: licenseTypeSeed.code },
      update: {
        name: licenseTypeSeed.name,
        isActive: true,
      },
      create: {
        code: licenseTypeSeed.code,
        name: licenseTypeSeed.name,
        isActive: true,
      },
    });
  }

  for (const vehicleCatalogSeed of vehicleCatalogSeeds) {
    const brand = await prisma.vehicleBrand.upsert({
      where: { name: vehicleCatalogSeed.brand },
      update: {
        isActive: true,
      },
      create: {
        name: vehicleCatalogSeed.brand,
        isActive: true,
      },
    });

    for (const modelSeed of vehicleCatalogSeed.models) {
      await prisma.vehicleModel.upsert({
        where: {
          brandId_name_vehicleType: {
            brandId: brand.id,
            name: modelSeed.name,
            vehicleType: modelSeed.vehicleType,
          },
        },
        update: {
          isActive: true,
        },
        create: {
          brandId: brand.id,
          name: modelSeed.name,
          vehicleType: modelSeed.vehicleType,
          isActive: true,
        },
      });
    }
  }
}

async function upsertUser(params: {
  id: string;
  email: string;
  password: string;
  fullName: string;
  documentType?: DocumentType;
  documentNumber: string;
  globalRole?: GlobalUserRole;
  career?: string;
  phone?: string;
  referenceNeighborhood?: string;
  membershipId: string;
  membershipRole?: MembershipRole;
  membershipStatus?: MembershipStatus;
  studentCode: string;
  driverVerificationStatus?: DriverVerificationStatus;
}): Promise<void> {
  const passwordHash = await hash(params.password, 10);
  const now = new Date();

  await prisma.user.upsert({
    where: { email: params.email.toLowerCase() },
    update: {
      id: params.id,
      passwordHash,
      fullName: params.fullName,
      documentType: params.documentType ?? DocumentType.NATIONAL_ID,
      documentNumber: params.documentNumber,
      globalRole: params.globalRole ?? GlobalUserRole.USER,
      accountStatus: AccountStatus.ACTIVE,
      emailVerifiedAt: now,
      career: params.career ?? null,
      phone: params.phone ?? null,
      referenceNeighborhood: params.referenceNeighborhood ?? null,
      termsAcceptedAt: now,
      privacyAcceptedAt: now,
      safetyRulesAcceptedAt: now,
      onboardingCompletedAt: now,
    },
    create: {
      id: params.id,
      email: params.email.toLowerCase(),
      passwordHash,
      fullName: params.fullName,
      documentType: params.documentType ?? DocumentType.NATIONAL_ID,
      documentNumber: params.documentNumber,
      globalRole: params.globalRole ?? GlobalUserRole.USER,
      accountStatus: AccountStatus.ACTIVE,
      emailVerifiedAt: now,
      career: params.career ?? null,
      phone: params.phone ?? null,
      referenceNeighborhood: params.referenceNeighborhood ?? null,
      termsAcceptedAt: now,
      privacyAcceptedAt: now,
      safetyRulesAcceptedAt: now,
      onboardingCompletedAt: now,
    },
  });

  await prisma.userInstitutionMembership.upsert({
    where: {
      userId_institutionId: {
        userId: params.id,
        institutionId: institutionSeed.id,
      },
    },
    update: {
      id: params.membershipId,
      role: params.membershipRole ?? MembershipRole.STUDENT,
      membershipStatus: params.membershipStatus ?? MembershipStatus.ACTIVE,
      studentCode: params.studentCode,
      isDefault: true,
      driverVerificationStatus: params.driverVerificationStatus ?? DriverVerificationStatus.NOT_REQUESTED,
    },
    create: {
      id: params.membershipId,
      userId: params.id,
      institutionId: institutionSeed.id,
      role: params.membershipRole ?? MembershipRole.STUDENT,
      membershipStatus: params.membershipStatus ?? MembershipStatus.ACTIVE,
      studentCode: params.studentCode,
      isDefault: true,
      driverVerificationStatus: params.driverVerificationStatus ?? DriverVerificationStatus.NOT_REQUESTED,
    },
  });
}

async function main(): Promise<void> {
  const now = new Date();

  await prisma.institution.upsert({
    where: { code: institutionSeed.code },
    update: {
      id: institutionSeed.id,
      name: institutionSeed.name,
      isActive: true,
    },
    create: {
      id: institutionSeed.id,
      name: institutionSeed.name,
      code: institutionSeed.code,
      isActive: true,
    },
  });

  await prisma.institutionDomain.upsert({
    where: { domain: institutionSeed.domain },
    update: {
      institutionId: institutionSeed.id,
      isActive: true,
      isPrimary: true,
    },
    create: {
      institutionId: institutionSeed.id,
      domain: institutionSeed.domain,
      isPrimary: true,
      isActive: true,
    },
  });

  await prisma.institutionSettings.upsert({
    where: { institutionId: institutionSeed.id },
    update: {
      id: staticIds.settings,
      allowCashPayments: true,
      allowPaypalPayments: true,
      termsDocumentUrl: 'https://example.com/terminos-saferidepro',
      privacyPolicyUrl: 'https://example.com/privacidad-saferidepro',
      safetyRulesTitle: 'Compromiso de viaje seguro',
      safetyRulesSummary:
        'Respeta el punto de encuentro, confirma la identidad del conductor y mantente localizable durante todo el trayecto.',
      safetyRulesBody:
        '1. Llega con anticipacion al punto acordado.\n2. Verifica conductor, vehiculo y placa antes de abordar.\n3. Mantente identificado y avisa cualquier novedad.\n4. Usa la plataforma solo dentro del protocolo institucional.\n5. Reporta cualquier conducta insegura o incumplimiento.',
    },
    create: {
      id: staticIds.settings,
      institutionId: institutionSeed.id,
      allowCashPayments: true,
      allowPaypalPayments: true,
      termsDocumentUrl: 'https://example.com/terminos-saferidepro',
      privacyPolicyUrl: 'https://example.com/privacidad-saferidepro',
      safetyRulesTitle: 'Compromiso de viaje seguro',
      safetyRulesSummary:
        'Respeta el punto de encuentro, confirma la identidad del conductor y mantente localizable durante todo el trayecto.',
      safetyRulesBody:
        '1. Llega con anticipacion al punto acordado.\n2. Verifica conductor, vehiculo y placa antes de abordar.\n3. Mantente identificado y avisa cualquier novedad.\n4. Usa la plataforma solo dentro del protocolo institucional.\n5. Reporta cualquier conducta insegura o incumplimiento.',
    },
  });

  await seedCatalogs();

  await upsertUser({
    ...superAdminSeed,
    password: superAdminSeed.password,
    globalRole: GlobalUserRole.SUPER_ADMIN,
    membershipRole: MembershipRole.INSTITUTION_ADMIN,
    driverVerificationStatus: DriverVerificationStatus.NOT_REQUESTED,
  });

  await upsertUser({
    ...qaUserSeeds.passenger,
  });

  await upsertUser({
    ...qaUserSeeds.passengerTwo,
  });

  await upsertUser({
    ...qaUserSeeds.driverApproved,
    driverVerificationStatus: DriverVerificationStatus.APPROVED,
  });

  await upsertUser({
    ...qaUserSeeds.driverPending,
    driverVerificationStatus: DriverVerificationStatus.PENDING_VERIFICATION,
  });

  const licenseTypeB = await prisma.licenseType.findUniqueOrThrow({
    where: { code: 'B' },
  });

  const corollaModel = await prisma.vehicleModel.findFirstOrThrow({
    where: {
      name: 'Corolla',
      vehicleType: VehicleType.CAR,
      brand: {
        name: 'Toyota',
      },
    },
    include: {
      brand: true,
    },
  });

  await prisma.driverProfile.upsert({
    where: { membershipId: qaUserSeeds.driverApproved.membershipId },
    update: {
      id: staticIds.approvedDriverProfile,
      licenseTypeId: licenseTypeB.id,
      licenseExpiresAt: new Date('2031-12-31T00:00:00.000Z'),
      identityDocumentFileKey: 'seed/driver-approved/cedula.pdf',
      licenseDocumentFileKey: 'seed/driver-approved/licencia.pdf',
      reviewNotes: 'Solicitud aprobada para pruebas QA.',
      submittedAt: new Date('2030-01-01T09:00:00.000Z'),
      reviewedAt: new Date('2030-01-01T10:00:00.000Z'),
      reviewedByUserId: superAdminSeed.id,
    },
    create: {
      id: staticIds.approvedDriverProfile,
      membershipId: qaUserSeeds.driverApproved.membershipId,
      licenseTypeId: licenseTypeB.id,
      licenseExpiresAt: new Date('2031-12-31T00:00:00.000Z'),
      identityDocumentFileKey: 'seed/driver-approved/cedula.pdf',
      licenseDocumentFileKey: 'seed/driver-approved/licencia.pdf',
      reviewNotes: 'Solicitud aprobada para pruebas QA.',
      submittedAt: new Date('2030-01-01T09:00:00.000Z'),
      reviewedAt: new Date('2030-01-01T10:00:00.000Z'),
      reviewedByUserId: superAdminSeed.id,
    },
  });

  await prisma.driverProfile.upsert({
    where: { membershipId: qaUserSeeds.driverPending.membershipId },
    update: {
      id: staticIds.pendingDriverProfile,
      licenseTypeId: licenseTypeB.id,
      licenseExpiresAt: new Date('2031-08-31T00:00:00.000Z'),
      identityDocumentFileKey: 'seed/driver-pending/cedula.pdf',
      licenseDocumentFileKey: 'seed/driver-pending/licencia.pdf',
      reviewNotes: null,
      submittedAt: new Date('2030-01-02T09:30:00.000Z'),
      reviewedAt: null,
      reviewedByUserId: null,
    },
    create: {
      id: staticIds.pendingDriverProfile,
      membershipId: qaUserSeeds.driverPending.membershipId,
      licenseTypeId: licenseTypeB.id,
      licenseExpiresAt: new Date('2031-08-31T00:00:00.000Z'),
      identityDocumentFileKey: 'seed/driver-pending/cedula.pdf',
      licenseDocumentFileKey: 'seed/driver-pending/licencia.pdf',
      submittedAt: new Date('2030-01-02T09:30:00.000Z'),
    },
  });

  await prisma.vehicle.upsert({
    where: { plate: 'TBC-1203' },
    update: {
      id: staticIds.approvedVehicle,
      membershipId: qaUserSeeds.driverApproved.membershipId,
      vehicleType: VehicleType.CAR,
      brandId: corollaModel.brandId,
      modelId: corollaModel.id,
      customBrandName: null,
      customModelName: null,
      year: 2020,
      color: 'Gris plata',
      seatCount: 4,
      luggagePolicy: LuggagePolicy.UP_TO_MEDIUM,
      registrationDocumentFileKey: 'seed/vehicles/tbc-1203-matricula.pdf',
      isActive: true,
    },
    create: {
      id: staticIds.approvedVehicle,
      membershipId: qaUserSeeds.driverApproved.membershipId,
      vehicleType: VehicleType.CAR,
      brandId: corollaModel.brandId,
      modelId: corollaModel.id,
      year: 2020,
      color: 'Gris plata',
      plate: 'TBC-1203',
      seatCount: 4,
      luggagePolicy: LuggagePolicy.UP_TO_MEDIUM,
      registrationDocumentFileKey: 'seed/vehicles/tbc-1203-matricula.pdf',
      isActive: true,
    },
  });

  const tripBase = {
    institutionId: institutionSeed.id,
    driverMembershipId: qaUserSeeds.driverApproved.membershipId,
    vehicleId: staticIds.approvedVehicle,
    routeMode: TripRouteMode.DIRECT_ROUTE,
    vehicleTypeSnapshot: VehicleType.CAR,
    luggagePolicySnapshot: LuggagePolicy.UP_TO_MEDIUM,
    detourSurchargeReference: new Prisma.Decimal('0.00'),
  };

  await prisma.trip.upsert({
    where: { id: staticIds.tripPublished },
    update: {
      ...tripBase,
      status: TripStatus.PUBLISHED,
      originLabel: 'Ficoa',
      destinationLabel: 'UTA Campus Huachi',
      originLatitude: -1.24252,
      originLongitude: -78.61577,
      destinationLatitude: -1.26764,
      destinationLongitude: -78.62592,
      departureAt: new Date('2030-01-10T22:00:00.000Z'),
      estimatedArrivalAt: new Date('2030-01-10T22:30:00.000Z'),
      seatCount: 3,
      availableSeats: 2,
      basePriceReference: new Prisma.Decimal('2.50'),
      notes: 'Viaje de prueba publicado para solicitudes nuevas.',
      closureNote: null,
      cancelledAt: null,
      completedAt: null,
    },
    create: {
      id: staticIds.tripPublished,
      ...tripBase,
      status: TripStatus.PUBLISHED,
      originLabel: 'Ficoa',
      destinationLabel: 'UTA Campus Huachi',
      originLatitude: -1.24252,
      originLongitude: -78.61577,
      destinationLatitude: -1.26764,
      destinationLongitude: -78.62592,
      departureAt: new Date('2030-01-10T22:00:00.000Z'),
      estimatedArrivalAt: new Date('2030-01-10T22:30:00.000Z'),
      seatCount: 3,
      availableSeats: 2,
      basePriceReference: new Prisma.Decimal('2.50'),
      notes: 'Viaje de prueba publicado para solicitudes nuevas.',
    },
  });

  await prisma.trip.upsert({
    where: { id: staticIds.tripDraft },
    update: {
      ...tripBase,
      status: TripStatus.DRAFT,
      originLabel: 'Atocha',
      destinationLabel: 'UTA Centro',
      originLatitude: -1.25333,
      originLongitude: -78.62125,
      destinationLatitude: -1.24894,
      destinationLongitude: -78.61629,
      departureAt: new Date('2030-01-11T07:15:00.000Z'),
      estimatedArrivalAt: new Date('2030-01-11T07:35:00.000Z'),
      seatCount: 4,
      availableSeats: 4,
      basePriceReference: new Prisma.Decimal('1.75'),
      notes: 'Borrador listo para editar y publicar.',
      closureNote: null,
      cancelledAt: null,
      completedAt: null,
    },
    create: {
      id: staticIds.tripDraft,
      ...tripBase,
      status: TripStatus.DRAFT,
      originLabel: 'Atocha',
      destinationLabel: 'UTA Centro',
      originLatitude: -1.25333,
      originLongitude: -78.62125,
      destinationLatitude: -1.24894,
      destinationLongitude: -78.61629,
      departureAt: new Date('2030-01-11T07:15:00.000Z'),
      estimatedArrivalAt: new Date('2030-01-11T07:35:00.000Z'),
      seatCount: 4,
      availableSeats: 4,
      basePriceReference: new Prisma.Decimal('1.75'),
      notes: 'Borrador listo para editar y publicar.',
    },
  });

  await prisma.trip.upsert({
    where: { id: staticIds.tripCompleted },
    update: {
      ...tripBase,
      status: TripStatus.COMPLETED,
      originLabel: 'Huachi Chico',
      destinationLabel: 'UTA FISEI',
      originLatitude: -1.2661,
      originLongitude: -78.6312,
      destinationLatitude: -1.2699,
      destinationLongitude: -78.6238,
      departureAt: new Date('2030-01-05T18:00:00.000Z'),
      estimatedArrivalAt: new Date('2030-01-05T18:25:00.000Z'),
      seatCount: 2,
      availableSeats: 1,
      basePriceReference: new Prisma.Decimal('2.00'),
      notes: 'Viaje completado para pruebas de confianza y reportes.',
      closureNote: 'Cierre normal del viaje de pruebas.',
      completedAt: new Date('2030-01-05T18:27:00.000Z'),
      cancelledAt: null,
    },
    create: {
      id: staticIds.tripCompleted,
      ...tripBase,
      status: TripStatus.COMPLETED,
      originLabel: 'Huachi Chico',
      destinationLabel: 'UTA FISEI',
      originLatitude: -1.2661,
      originLongitude: -78.6312,
      destinationLatitude: -1.2699,
      destinationLongitude: -78.6238,
      departureAt: new Date('2030-01-05T18:00:00.000Z'),
      estimatedArrivalAt: new Date('2030-01-05T18:25:00.000Z'),
      seatCount: 2,
      availableSeats: 1,
      basePriceReference: new Prisma.Decimal('2.00'),
      notes: 'Viaje completado para pruebas de confianza y reportes.',
      closureNote: 'Cierre normal del viaje de pruebas.',
      completedAt: new Date('2030-01-05T18:27:00.000Z'),
    },
  });

  await prisma.trip.upsert({
    where: { id: staticIds.tripInProgress },
    update: {
      ...tripBase,
      status: TripStatus.IN_PROGRESS,
      originLabel: 'Izamba',
      destinationLabel: 'UTA Huachi',
      originLatitude: -1.2334,
      originLongitude: -78.6038,
      destinationLatitude: -1.26764,
      destinationLongitude: -78.62592,
      departureAt: new Date('2030-01-10T20:00:00.000Z'),
      estimatedArrivalAt: new Date('2030-01-10T20:35:00.000Z'),
      seatCount: 3,
      availableSeats: 2,
      basePriceReference: new Prisma.Decimal('2.25'),
      notes: 'Viaje en curso para pruebas de tracking y operacion.',
      closureNote: null,
      completedAt: null,
      cancelledAt: null,
    },
    create: {
      id: staticIds.tripInProgress,
      ...tripBase,
      status: TripStatus.IN_PROGRESS,
      originLabel: 'Izamba',
      destinationLabel: 'UTA Huachi',
      originLatitude: -1.2334,
      originLongitude: -78.6038,
      destinationLatitude: -1.26764,
      destinationLongitude: -78.62592,
      departureAt: new Date('2030-01-10T20:00:00.000Z'),
      estimatedArrivalAt: new Date('2030-01-10T20:35:00.000Z'),
      seatCount: 3,
      availableSeats: 2,
      basePriceReference: new Prisma.Decimal('2.25'),
      notes: 'Viaje en curso para pruebas de tracking y operacion.',
    },
  });

  await prisma.tripLiveTracking.upsert({
    where: { tripId: staticIds.tripInProgress },
    update: {
      id: staticIds.trackingInProgress,
      status: TripLiveTrackingStatus.ACTIVE,
      startedAt: new Date('2030-01-10T20:02:00.000Z'),
      endedAt: null,
      lastSignalAt: new Date('2030-01-10T20:12:00.000Z'),
      currentLatitude: -1.2474,
      currentLongitude: -78.6147,
      currentAccuracyMeters: 9,
      currentHeadingDegrees: 135,
      currentSpeedKph: 32,
    },
    create: {
      id: staticIds.trackingInProgress,
      tripId: staticIds.tripInProgress,
      status: TripLiveTrackingStatus.ACTIVE,
      startedAt: new Date('2030-01-10T20:02:00.000Z'),
      lastSignalAt: new Date('2030-01-10T20:12:00.000Z'),
      currentLatitude: -1.2474,
      currentLongitude: -78.6147,
      currentAccuracyMeters: 9,
      currentHeadingDegrees: 135,
      currentSpeedKph: 32,
    },
  });

  await prisma.tripLiveTrackingPoint.upsert({
    where: { id: staticIds.trackingPointOne },
    update: {
      trackingId: staticIds.trackingInProgress,
      capturedAt: new Date('2030-01-10T20:08:00.000Z'),
      latitude: -1.2412,
      longitude: -78.6088,
      accuracyMeters: 10,
      headingDegrees: 120,
      speedKph: 25,
    },
    create: {
      id: staticIds.trackingPointOne,
      trackingId: staticIds.trackingInProgress,
      capturedAt: new Date('2030-01-10T20:08:00.000Z'),
      latitude: -1.2412,
      longitude: -78.6088,
      accuracyMeters: 10,
      headingDegrees: 120,
      speedKph: 25,
    },
  });

  await prisma.tripLiveTrackingPoint.upsert({
    where: { id: staticIds.trackingPointTwo },
    update: {
      trackingId: staticIds.trackingInProgress,
      capturedAt: new Date('2030-01-10T20:12:00.000Z'),
      latitude: -1.2474,
      longitude: -78.6147,
      accuracyMeters: 9,
      headingDegrees: 135,
      speedKph: 32,
    },
    create: {
      id: staticIds.trackingPointTwo,
      trackingId: staticIds.trackingInProgress,
      capturedAt: new Date('2030-01-10T20:12:00.000Z'),
      latitude: -1.2474,
      longitude: -78.6147,
      accuracyMeters: 9,
      headingDegrees: 135,
      speedKph: 32,
    },
  });

  await prisma.tripRequest.upsert({
    where: { id: staticIds.requestPending },
    update: {
      tripId: staticIds.tripPublished,
      passengerMembershipId: qaUserSeeds.passenger.membershipId,
      status: TripRequestStatus.PENDING,
      executionStatus: null,
      requestMessage: 'Necesito llegar al campus para la clase nocturna.',
      reviewNote: null,
      reviewedAt: null,
      cancelledAt: null,
      boardedAt: null,
      droppedOffAt: null,
      executionStatusUpdatedAt: null,
    },
    create: {
      id: staticIds.requestPending,
      tripId: staticIds.tripPublished,
      passengerMembershipId: qaUserSeeds.passenger.membershipId,
      status: TripRequestStatus.PENDING,
      requestMessage: 'Necesito llegar al campus para la clase nocturna.',
    },
  });

  await prisma.tripRequest.upsert({
    where: { id: staticIds.requestAccepted },
    update: {
      tripId: staticIds.tripPublished,
      passengerMembershipId: qaUserSeeds.passengerTwo.membershipId,
      status: TripRequestStatus.ACCEPTED,
      executionStatus: TripRequestExecutionStatus.ACCEPTED_PENDING_BOARDING,
      requestMessage: 'Voy con mochila pequena.',
      reviewNote: 'Solicitud aprobada para el seed.',
      reviewedAt: new Date('2030-01-09T21:00:00.000Z'),
      cancelledAt: null,
      boardedAt: null,
      droppedOffAt: null,
      executionStatusUpdatedAt: new Date('2030-01-09T21:00:00.000Z'),
    },
    create: {
      id: staticIds.requestAccepted,
      tripId: staticIds.tripPublished,
      passengerMembershipId: qaUserSeeds.passengerTwo.membershipId,
      status: TripRequestStatus.ACCEPTED,
      executionStatus: TripRequestExecutionStatus.ACCEPTED_PENDING_BOARDING,
      requestMessage: 'Voy con mochila pequena.',
      reviewNote: 'Solicitud aprobada para el seed.',
      reviewedAt: new Date('2030-01-09T21:00:00.000Z'),
      executionStatusUpdatedAt: new Date('2030-01-09T21:00:00.000Z'),
    },
  });

  await prisma.tripRequest.upsert({
    where: { id: staticIds.requestRejected },
    update: {
      tripId: staticIds.tripPublished,
      passengerMembershipId: qaUserSeeds.driverPending.membershipId,
      status: TripRequestStatus.REJECTED,
      executionStatus: null,
      requestMessage: 'Necesito llegar rapido.',
      reviewNote: 'No hay coincidencia operativa con esta reserva.',
      reviewedAt: new Date('2030-01-09T21:15:00.000Z'),
      cancelledAt: null,
      boardedAt: null,
      droppedOffAt: null,
      executionStatusUpdatedAt: null,
    },
    create: {
      id: staticIds.requestRejected,
      tripId: staticIds.tripPublished,
      passengerMembershipId: qaUserSeeds.driverPending.membershipId,
      status: TripRequestStatus.REJECTED,
      requestMessage: 'Necesito llegar rapido.',
      reviewNote: 'No hay coincidencia operativa con esta reserva.',
      reviewedAt: new Date('2030-01-09T21:15:00.000Z'),
    },
  });

  await prisma.tripRequest.upsert({
    where: { id: staticIds.requestCompleted },
    update: {
      tripId: staticIds.tripCompleted,
      passengerMembershipId: qaUserSeeds.passenger.membershipId,
      status: TripRequestStatus.ACCEPTED,
      executionStatus: TripRequestExecutionStatus.DROPPED_OFF,
      requestMessage: 'Viaje de pruebas completado.',
      reviewNote: 'Participacion confirmada y finalizada.',
      reviewedAt: new Date('2030-01-05T17:45:00.000Z'),
      boardedAt: new Date('2030-01-05T18:03:00.000Z'),
      droppedOffAt: new Date('2030-01-05T18:26:00.000Z'),
      executionStatusUpdatedAt: new Date('2030-01-05T18:26:00.000Z'),
      cancelledAt: null,
    },
    create: {
      id: staticIds.requestCompleted,
      tripId: staticIds.tripCompleted,
      passengerMembershipId: qaUserSeeds.passenger.membershipId,
      status: TripRequestStatus.ACCEPTED,
      executionStatus: TripRequestExecutionStatus.DROPPED_OFF,
      requestMessage: 'Viaje de pruebas completado.',
      reviewNote: 'Participacion confirmada y finalizada.',
      reviewedAt: new Date('2030-01-05T17:45:00.000Z'),
      boardedAt: new Date('2030-01-05T18:03:00.000Z'),
      droppedOffAt: new Date('2030-01-05T18:26:00.000Z'),
      executionStatusUpdatedAt: new Date('2030-01-05T18:26:00.000Z'),
    },
  });

  await prisma.tripPayment.upsert({
    where: { id: staticIds.paymentAccepted },
    update: {
      institutionId: institutionSeed.id,
      tripId: staticIds.tripPublished,
      tripRequestId: staticIds.requestAccepted,
      passengerMembershipId: qaUserSeeds.passengerTwo.membershipId,
      driverMembershipId: qaUserSeeds.driverApproved.membershipId,
      provider: PaymentProvider.PAYPAL,
      status: 'PENDING',
      currencyCode: 'USD',
      amount: new Prisma.Decimal('2.50'),
      merchantOrderReference: 'seed-order-pending-001',
      providerOrderToken: null,
      providerPaymentLinkId: null,
      providerPaymentLinkUrl: null,
      providerOrderStatus: null,
      providerPaymentStatus: null,
      failureReason: null,
      paidAt: null,
      cancelledAt: null,
      expiresAt: new Date('2030-01-10T21:50:00.000Z'),
      lastSyncedAt: null,
    },
    create: {
      id: staticIds.paymentAccepted,
      institutionId: institutionSeed.id,
      tripId: staticIds.tripPublished,
      tripRequestId: staticIds.requestAccepted,
      passengerMembershipId: qaUserSeeds.passengerTwo.membershipId,
      driverMembershipId: qaUserSeeds.driverApproved.membershipId,
      provider: PaymentProvider.PAYPAL,
      status: 'PENDING',
      currencyCode: 'USD',
      amount: new Prisma.Decimal('2.50'),
      merchantOrderReference: 'seed-order-pending-001',
      expiresAt: new Date('2030-01-10T21:50:00.000Z'),
    },
  });

  await prisma.tripPayment.upsert({
    where: { id: staticIds.paymentCompleted },
    update: {
      institutionId: institutionSeed.id,
      tripId: staticIds.tripCompleted,
      tripRequestId: staticIds.requestCompleted,
      passengerMembershipId: qaUserSeeds.passenger.membershipId,
      driverMembershipId: qaUserSeeds.driverApproved.membershipId,
      provider: PaymentProvider.CASH,
      status: 'PAID',
      currencyCode: 'USD',
      amount: new Prisma.Decimal('2.00'),
      merchantOrderReference: 'seed-order-paid-001',
      providerOrderToken: null,
      providerPaymentLinkId: null,
      providerPaymentLinkUrl: null,
      providerOrderStatus: 'CAPTURED',
      providerPaymentStatus: 'PAID',
      failureReason: null,
      paidAt: new Date('2030-01-05T18:02:00.000Z'),
      cancelledAt: null,
      expiresAt: null,
      lastSyncedAt: new Date('2030-01-05T18:02:00.000Z'),
    },
    create: {
      id: staticIds.paymentCompleted,
      institutionId: institutionSeed.id,
      tripId: staticIds.tripCompleted,
      tripRequestId: staticIds.requestCompleted,
      passengerMembershipId: qaUserSeeds.passenger.membershipId,
      driverMembershipId: qaUserSeeds.driverApproved.membershipId,
      provider: PaymentProvider.CASH,
      status: 'PAID',
      currencyCode: 'USD',
      amount: new Prisma.Decimal('2.00'),
      merchantOrderReference: 'seed-order-paid-001',
      providerOrderStatus: 'CAPTURED',
      providerPaymentStatus: 'PAID',
      paidAt: new Date('2030-01-05T18:02:00.000Z'),
      lastSyncedAt: new Date('2030-01-05T18:02:00.000Z'),
    },
  });

  await prisma.rating.upsert({
    where: {
      tripId_authorMembershipId_targetMembershipId: {
        tripId: staticIds.tripCompleted,
        authorMembershipId: qaUserSeeds.passenger.membershipId,
        targetMembershipId: qaUserSeeds.driverApproved.membershipId,
      },
    },
    update: {
      id: staticIds.ratingPassengerToDriver,
      score: 5,
      comment: 'Conductor puntual y cordial.',
    },
    create: {
      id: staticIds.ratingPassengerToDriver,
      tripId: staticIds.tripCompleted,
      authorMembershipId: qaUserSeeds.passenger.membershipId,
      targetMembershipId: qaUserSeeds.driverApproved.membershipId,
      score: 5,
      comment: 'Conductor puntual y cordial.',
    },
  });

  await prisma.rating.upsert({
    where: {
      tripId_authorMembershipId_targetMembershipId: {
        tripId: staticIds.tripCompleted,
        authorMembershipId: qaUserSeeds.driverApproved.membershipId,
        targetMembershipId: qaUserSeeds.passenger.membershipId,
      },
    },
    update: {
      id: staticIds.ratingDriverToPassenger,
      score: 4,
      comment: 'Pasajera puntual y respetuosa.',
    },
    create: {
      id: staticIds.ratingDriverToPassenger,
      tripId: staticIds.tripCompleted,
      authorMembershipId: qaUserSeeds.driverApproved.membershipId,
      targetMembershipId: qaUserSeeds.passenger.membershipId,
      score: 4,
      comment: 'Pasajera puntual y respetuosa.',
    },
  });

  await prisma.report.upsert({
    where: {
      tripId_reporterMembershipId_reportedMembershipId: {
        tripId: staticIds.tripCompleted,
        reporterMembershipId: qaUserSeeds.passenger.membershipId,
        reportedMembershipId: qaUserSeeds.driverApproved.membershipId,
      },
    },
    update: {
      id: staticIds.reportCompleted,
      status: ReportStatus.RESOLVED,
      reason: 'Conduccion riesgosa',
      description: 'Durante una parte del recorrido excedio la velocidad esperada.',
      evidenceFileKey: null,
      reviewNote: 'Se deja advertencia y seguimiento posterior.',
      reviewedAt: new Date('2030-01-06T10:30:00.000Z'),
      reviewedByUserId: superAdminSeed.id,
    },
    create: {
      id: staticIds.reportCompleted,
      tripId: staticIds.tripCompleted,
      reporterMembershipId: qaUserSeeds.passenger.membershipId,
      reportedMembershipId: qaUserSeeds.driverApproved.membershipId,
      status: ReportStatus.RESOLVED,
      reason: 'Conduccion riesgosa',
      description: 'Durante una parte del recorrido excedio la velocidad esperada.',
      reviewNote: 'Se deja advertencia y seguimiento posterior.',
      reviewedAt: new Date('2030-01-06T10:30:00.000Z'),
      reviewedByUserId: superAdminSeed.id,
    },
  });

  await prisma.operationalSanction.upsert({
    where: { id: staticIds.sanctionPassenger },
    update: {
      membershipId: qaUserSeeds.passengerTwo.membershipId,
      type: OperationalSanctionType.WARNING,
      scope: OperationalSanctionScope.PASSENGER,
      status: OperationalSanctionStatus.ACTIVE,
      trigger: OperationalSanctionTrigger.RESOLVED_REPORTS,
      reason: 'Advertencia por incidente reportado en viajes anteriores.',
      isAutomatic: false,
      startedAt: new Date('2030-01-07T09:00:00.000Z'),
      endsAt: null,
      expiredAt: null,
      metadata: { source: 'seed' },
    },
    create: {
      id: staticIds.sanctionPassenger,
      membershipId: qaUserSeeds.passengerTwo.membershipId,
      type: OperationalSanctionType.WARNING,
      scope: OperationalSanctionScope.PASSENGER,
      status: OperationalSanctionStatus.ACTIVE,
      trigger: OperationalSanctionTrigger.RESOLVED_REPORTS,
      reason: 'Advertencia por incidente reportado en viajes anteriores.',
      isAutomatic: false,
      startedAt: new Date('2030-01-07T09:00:00.000Z'),
      metadata: { source: 'seed' },
    },
  });

  await prisma.operationalSanctionAppeal.upsert({
    where: { sanctionId: staticIds.sanctionPassenger },
    update: {
      id: staticIds.appealPassenger,
      requestedByUserId: qaUserSeeds.passengerTwo.id,
      reason: 'Solicito una revision del contexto del incidente.',
      status: OperationalSanctionAppealStatus.PENDING,
      reviewNote: null,
      reviewedAt: null,
      reviewedByUserId: null,
    },
    create: {
      id: staticIds.appealPassenger,
      sanctionId: staticIds.sanctionPassenger,
      requestedByUserId: qaUserSeeds.passengerTwo.id,
      reason: 'Solicito una revision del contexto del incidente.',
      status: OperationalSanctionAppealStatus.PENDING,
    },
  });

  await prisma.appNotification.upsert({
    where: { id: staticIds.notificationDriverRequest },
    update: {
      institutionId: institutionSeed.id,
      recipientMembershipId: qaUserSeeds.driverApproved.membershipId,
      actorUserId: qaUserSeeds.passenger.id,
      type: AppNotificationType.TRIP_REQUEST_CREATED,
      title: 'Nueva solicitud de viaje',
      body: 'Andrea Pasajera solicito un cupo en el viaje publicado de esta noche.',
      actionUrl: '/viajes/aprobar-solicitudes?experienceMode=driver',
      readAt: null,
    },
    create: {
      id: staticIds.notificationDriverRequest,
      institutionId: institutionSeed.id,
      recipientMembershipId: qaUserSeeds.driverApproved.membershipId,
      actorUserId: qaUserSeeds.passenger.id,
      type: AppNotificationType.TRIP_REQUEST_CREATED,
      title: 'Nueva solicitud de viaje',
      body: 'Andrea Pasajera solicito un cupo en el viaje publicado de esta noche.',
      actionUrl: '/viajes/aprobar-solicitudes?experienceMode=driver',
    },
  });

  await prisma.appNotification.upsert({
    where: { id: staticIds.notificationPassengerAccepted },
    update: {
      institutionId: institutionSeed.id,
      recipientMembershipId: qaUserSeeds.passenger.membershipId,
      actorUserId: qaUserSeeds.driverApproved.id,
      type: AppNotificationType.TRIP_REQUEST_ACCEPTED,
      title: 'Solicitud aceptada',
      body: 'Tu cupo en el viaje de prueba ya fue aceptado por el conductor.',
      actionUrl: '/viajes?experienceMode=passenger',
      readAt: null,
    },
    create: {
      id: staticIds.notificationPassengerAccepted,
      institutionId: institutionSeed.id,
      recipientMembershipId: qaUserSeeds.passenger.membershipId,
      actorUserId: qaUserSeeds.driverApproved.id,
      type: AppNotificationType.TRIP_REQUEST_ACCEPTED,
      title: 'Solicitud aceptada',
      body: 'Tu cupo en el viaje de prueba ya fue aceptado por el conductor.',
      actionUrl: '/viajes?experienceMode=passenger',
    },
  });

  await prisma.auditEvent.upsert({
    where: { id: 'seed-audit-trip-created' },
    update: {
      institutionId: institutionSeed.id,
      actorUserId: qaUserSeeds.driverApproved.id,
      action: AuditAction.TRIP_CREATED,
      entityType: AuditEntityType.TRIP,
      entityId: staticIds.tripDraft,
      metadata: {
        source: 'seed',
        note: 'Evento de auditoria inicial para pruebas.',
      },
    },
    create: {
      id: 'seed-audit-trip-created',
      institutionId: institutionSeed.id,
      actorUserId: qaUserSeeds.driverApproved.id,
      action: AuditAction.TRIP_CREATED,
      entityType: AuditEntityType.TRIP,
      entityId: staticIds.tripDraft,
      metadata: {
        source: 'seed',
        note: 'Evento de auditoria inicial para pruebas.',
      },
    },
  });

  console.log('Seed completed successfully.');
  console.log(`Institution: ${institutionSeed.name} (${institutionSeed.code})`);
  console.log(`Domain: ${institutionSeed.domain}`);
  console.log(`Super admin: ${superAdminSeed.email} / ${superAdminSeed.password}`);
  console.log(`Passenger: ${qaUserSeeds.passenger.email} / ${qaUserSeeds.passenger.password}`);
  console.log(`Passenger 2: ${qaUserSeeds.passengerTwo.email} / ${qaUserSeeds.passengerTwo.password}`);
  console.log(`Approved driver: ${qaUserSeeds.driverApproved.email} / ${qaUserSeeds.driverApproved.password}`);
  console.log(`Pending driver: ${qaUserSeeds.driverPending.email} / ${qaUserSeeds.driverPending.password}`);
  console.log('Seeded modules: institution settings, driver profiles, vehicle, trips, requests, payments, ratings, reports, sanctions, appeals, notifications and audit.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
