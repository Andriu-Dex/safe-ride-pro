import { hash } from 'bcryptjs';
import {
  AccountStatus,
  DocumentType,
  GlobalUserRole,
  MembershipRole,
  MembershipStatus,
  PrismaClient,
} from '@prisma/client';

const prisma = new PrismaClient();

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

  console.log('Seed completed successfully.');
  console.log(`Institution: ${institution.name} (${institution.code})`);
  console.log(`Domain: ${institutionDomain}`);
  console.log(`Super admin: ${superAdmin.email}`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });