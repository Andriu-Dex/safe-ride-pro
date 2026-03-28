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
      { name: 'Hilux', vehicleType: VehicleType.PICKUP_TRUCK },
    ],
  },
  {
    brand: 'Chevrolet',
    models: [
      { name: 'Aveo', vehicleType: VehicleType.CAR },
      { name: 'D-Max', vehicleType: VehicleType.PICKUP_TRUCK },
    ],
  },
  {
    brand: 'Kia',
    models: [{ name: 'Rio', vehicleType: VehicleType.CAR }],
  },
  {
    brand: 'Honda',
    models: [{ name: 'CB125F', vehicleType: VehicleType.MOTORCYCLE }],
  },
  {
    brand: 'Yamaha',
    models: [{ name: 'MT-03', vehicleType: VehicleType.MOTORCYCLE }],
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