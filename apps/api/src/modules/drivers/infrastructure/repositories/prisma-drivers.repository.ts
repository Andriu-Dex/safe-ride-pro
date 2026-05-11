import { Injectable } from '@nestjs/common';
import {
  DriverLicenseStatus,
  DriverVerificationStatus,
  getDaysUntilDriverLicenseExpiration,
  getDriverLicenseStatus,
  getEffectiveDriverVerificationStatus,
  InstitutionMembershipRole,
  MembershipStatus,
} from '@saferidepro/shared-types';

import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import {
  DriverMembershipRecord,
  DriverProfileRecord,
  DriversRepository,
  ListReviewableDriverApplicationsFilters,
  ReviewDriverApplicationInput,
  SubmitDriverApplicationInput,
} from '../../application/ports/drivers.repository';

@Injectable()
export class PrismaDriversRepository implements DriversRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findDefaultMembershipByUserId(userId: string): Promise<DriverMembershipRecord | null> {
    const membership = await this.prisma.userInstitutionMembership.findFirst({
      where: {
        userId,
        membershipStatus: 'ACTIVE',
        institution: {
          isActive: true,
        },
      },
      include: {
        institution: true,
        driverProfile: {
          select: {
            licenseExpiresAt: true,
          },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { joinedAt: 'asc' }],
    });

    return membership ? this.mapMembership(membership) : null;
  }

  async findMembershipById(membershipId: string): Promise<DriverMembershipRecord | null> {
    const membership = await this.prisma.userInstitutionMembership.findUnique({
      where: { id: membershipId },
      include: {
        institution: true,
        driverProfile: {
          select: {
            licenseExpiresAt: true,
          },
        },
      },
    });

    return membership ? this.mapMembership(membership) : null;
  }

  async listInstitutionAdminMembershipIds(institutionId: string): Promise<string[]> {
    const memberships = await this.prisma.userInstitutionMembership.findMany({
      where: {
        institutionId,
        role: InstitutionMembershipRole.InstitutionAdmin,
        membershipStatus: 'ACTIVE',
        institution: {
          isActive: true,
        },
      },
      select: {
        id: true,
      },
    });

    return memberships.map((membership) => membership.id);
  }

  async findDriverProfileByMembershipId(membershipId: string): Promise<DriverProfileRecord | null> {
    const driverProfile = await this.prisma.driverProfile.findUnique({
      where: { membershipId },
      include: {
        licenseType: true,
        membership: {
          include: {
            institution: true,
            user: true,
          },
        },
      },
    });

    return driverProfile ? this.mapDriverProfile(driverProfile) : null;
  }

  async listReviewableDriverApplications(
    filters: ListReviewableDriverApplicationsFilters,
  ): Promise<DriverProfileRecord[]> {
    const items = await this.prisma.driverProfile.findMany({
      where: {
        membership: {
          institutionId: filters.institutionIds
            ? { in: filters.institutionIds }
            : undefined,
          role: InstitutionMembershipRole.Student,
          driverVerificationStatus: filters.status,
          membershipStatus: 'ACTIVE',
        },
      },
      include: {
        licenseType: true,
        membership: {
          include: {
            institution: true,
            user: true,
          },
        },
      },
      orderBy: [{ submittedAt: 'desc' }],
      take: filters.limit ?? 25,
    });

    return items.map((item) => this.mapDriverProfile(item));
  }

  async submitDriverApplication(
    input: SubmitDriverApplicationInput,
  ): Promise<DriverProfileRecord> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.userInstitutionMembership.update({
        where: { id: input.membershipId },
        data: {
          driverVerificationStatus: 'PENDING_VERIFICATION',
        },
      });

      const driverProfile = await transaction.driverProfile.upsert({
        where: {
          membershipId: input.membershipId,
        },
        update: {
          licenseTypeId: input.licenseTypeId,
          licenseExpiresAt: input.licenseExpiresAt,
          identityDocumentFileKey: input.identityDocumentFileKey,
          licenseDocumentFileKey: input.licenseDocumentFileKey,
          reviewNotes: null,
          reviewedAt: null,
          reviewedByUserId: null,
          submittedAt: new Date(),
        },
        create: {
          membershipId: input.membershipId,
          licenseTypeId: input.licenseTypeId,
          licenseExpiresAt: input.licenseExpiresAt,
          identityDocumentFileKey: input.identityDocumentFileKey,
          licenseDocumentFileKey: input.licenseDocumentFileKey,
        },
        include: {
          licenseType: true,
          membership: {
            include: {
              institution: true,
              user: true,
            },
          },
        },
      });

      return this.mapDriverProfile(driverProfile);
    });
  }

  async reviewDriverApplication(
    input: ReviewDriverApplicationInput,
  ): Promise<DriverProfileRecord> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.userInstitutionMembership.update({
        where: { id: input.membershipId },
        data: {
          driverVerificationStatus: input.decision,
        },
      });

      const driverProfile = await transaction.driverProfile.update({
        where: {
          membershipId: input.membershipId,
        },
        data: {
          reviewNotes: input.reviewNotes ?? null,
          reviewedAt: new Date(),
          reviewedByUserId: input.reviewerUserId,
        },
        include: {
          licenseType: true,
          membership: {
            include: {
              institution: true,
              user: true,
            },
          },
        },
      });

      return this.mapDriverProfile(driverProfile);
    });
  }

  private mapMembership(membership: {
    id: string;
    userId: string;
    institutionId: string;
    role: string;
    membershipStatus: string;
    studentCode: string;
    isDefault: boolean;
    driverVerificationStatus: string;
    driverProfile?: {
      licenseExpiresAt: Date;
    } | null;
    institution: { name: string };
  }): DriverMembershipRecord {
    const licenseExpiresAt = membership.driverProfile?.licenseExpiresAt ?? null;
    const licenseStatus = getDriverLicenseStatus(licenseExpiresAt);

    return {
      id: membership.id,
      userId: membership.userId,
      institutionId: membership.institutionId,
      institutionName: membership.institution.name,
      role: membership.role as InstitutionMembershipRole,
      membershipStatus: membership.membershipStatus as MembershipStatus,
      studentCode: membership.studentCode,
      isDefault: membership.isDefault,
      driverVerificationStatus:
        membership.driverVerificationStatus as DriverVerificationStatus,
      effectiveDriverVerificationStatus: getEffectiveDriverVerificationStatus(
        membership.driverVerificationStatus as DriverVerificationStatus,
        licenseExpiresAt,
      ) as DriverVerificationStatus,
      licenseExpiresAt,
      licenseStatus,
      licenseExpiresInDays: getDaysUntilDriverLicenseExpiration(licenseExpiresAt),
    };
  }

  private mapDriverProfile(driverProfile: {
    membershipId: string;
    licenseExpiresAt: Date;
    identityDocumentFileKey: string | null;
    licenseDocumentFileKey: string | null;
    reviewNotes: string | null;
    reviewedAt: Date | null;
    reviewedByUserId: string | null;
    submittedAt: Date;
    licenseType: {
      id: string;
      code: string;
      name: string;
    };
    membership: {
      userId: string;
      institutionId: string;
      driverVerificationStatus: string;
      user: {
        email: string;
        fullName: string;
      };
      institution: {
        name: string;
      };
    };
  }): DriverProfileRecord {
    return {
      membershipId: driverProfile.membershipId,
      userId: driverProfile.membership.userId,
      userFullName: driverProfile.membership.user.fullName,
      userEmail: driverProfile.membership.user.email,
      institutionId: driverProfile.membership.institutionId,
      institutionName: driverProfile.membership.institution.name,
      driverVerificationStatus:
        driverProfile.membership.driverVerificationStatus as DriverVerificationStatus,
      licenseType: driverProfile.licenseType,
      licenseExpiresAt: driverProfile.licenseExpiresAt,
      licenseStatus: getDriverLicenseStatus(driverProfile.licenseExpiresAt),
      licenseExpiresInDays: getDaysUntilDriverLicenseExpiration(driverProfile.licenseExpiresAt),
      identityDocumentFileKey: driverProfile.identityDocumentFileKey,
      licenseDocumentFileKey: driverProfile.licenseDocumentFileKey,
      hasRequiredDocuments:
        Boolean(driverProfile.identityDocumentFileKey) &&
        Boolean(driverProfile.licenseDocumentFileKey),
      reviewNotes: driverProfile.reviewNotes,
      reviewedAt: driverProfile.reviewedAt,
      reviewedByUserId: driverProfile.reviewedByUserId,
      submittedAt: driverProfile.submittedAt,
    };
  }
}
