import { hash } from 'bcryptjs';
import {
  AccountStatus,
  DocumentType,
  GlobalUserRole,
  MembershipRole,
  MembershipStatus,
  PrismaClient,
  VehicleType,
} from '@prisma/client';

const prisma = new PrismaClient();

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

async function main(): Promise<void> {
  const institutionName = process.env.DEFAULT_INSTITUTION_NAME ?? 'Universidad Tecnica de Ambato';
  const institutionCode = process.env.DEFAULT_INSTITUTION_CODE ?? 'UTA';
  const institutionDomain = process.env.DEFAULT_INSTITUTION_DOMAIN ?? 'uta.edu.ec';
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL ?? 'admin@uta.edu.ec';
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD ?? 'ChangeMe123!';
  const superAdminFullName = process.env.SUPER_ADMIN_FULL_NAME ?? 'SafeRidePro Super Admin';
  const superAdminDocumentType =
    (process.env.SUPER_ADMIN_DOCUMENT_TYPE as DocumentType | undefined) ?? DocumentType.NATIONAL_ID;
  const superAdminDocumentNumber = process.env.SUPER_ADMIN_DOCUMENT_NUMBER ?? '0000000000';

  const institution = await prisma.institution.upsert({
    where: { code: institutionCode },
    update: {
      name: institutionName,
      isActive: true,
    },
    create: {
      name: institutionName,
      code: institutionCode,
      isActive: true,
    },
  });

  await prisma.institutionDomain.upsert({
    where: { domain: institutionDomain },
    update: {
      institutionId: institution.id,
      isActive: true,
      isPrimary: true,
    },
    create: {
      institutionId: institution.id,
      domain: institutionDomain,
      isPrimary: true,
      isActive: true,
    },
  });

  const passwordHash = await hash(superAdminPassword, 10);

  const superAdmin = await prisma.user.upsert({
    where: { email: superAdminEmail.toLowerCase() },
    update: {
      fullName: superAdminFullName,
      passwordHash,
      documentType: superAdminDocumentType,
      documentNumber: superAdminDocumentNumber,
      globalRole: GlobalUserRole.SUPER_ADMIN,
      accountStatus: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date(),
    },
    create: {
      email: superAdminEmail.toLowerCase(),
      passwordHash,
      fullName: superAdminFullName,
      documentType: superAdminDocumentType,
      documentNumber: superAdminDocumentNumber,
      globalRole: GlobalUserRole.SUPER_ADMIN,
      accountStatus: AccountStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      memberships: {
        create: {
          institutionId: institution.id,
          role: MembershipRole.INSTITUTION_ADMIN,
          membershipStatus: MembershipStatus.ACTIVE,
          studentCode: 'ADMIN-001',
          isDefault: true,
        },
      },
    },
    include: {
      memberships: true,
    },
  });

  const existingMembership = superAdmin.memberships.find(
    (membership) => membership.institutionId === institution.id,
  );

  if (!existingMembership) {
    await prisma.userInstitutionMembership.create({
      data: {
        userId: superAdmin.id,
        institutionId: institution.id,
        role: MembershipRole.INSTITUTION_ADMIN,
        membershipStatus: MembershipStatus.ACTIVE,
        studentCode: 'ADMIN-001',
        isDefault: true,
      },
    });
  }

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

  console.log('Seed completed successfully.');
  console.log(`Institution: ${institution.name} (${institution.code})`);
  console.log(`Domain: ${institutionDomain}`);
  console.log(`Super admin: ${superAdmin.email}`);
  console.log(`License types: ${licenseTypeSeeds.length}`);
  console.log(`Vehicle brands: ${vehicleCatalogSeeds.length}`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
