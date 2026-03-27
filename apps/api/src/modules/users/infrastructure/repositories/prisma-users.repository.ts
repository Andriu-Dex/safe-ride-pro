import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AccountStatus,
  DocumentType,
  DriverVerificationStatus,
  GlobalUserRole,
  MembershipRole,
  MembershipStatus,
} from '@prisma/client';
import {
  AccountStatus as SharedAccountStatus,
  DriverVerificationStatus as SharedDriverVerificationStatus,
  GlobalUserRole as SharedGlobalUserRole,
  InstitutionMembershipRole,
  MembershipStatus as SharedMembershipStatus,
} from '@saferidepro/shared-types';

import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import {
  UpdateUserProfileInput,
  UserProfile,
  UsersRepository,
} from '../../application/ports/users.repository';

@Injectable()
export class PrismaUsersRepository implements UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(userId: string): Promise<UserProfile | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          include: {
            institution: true,
          },
          orderBy: [{ isDefault: 'desc' }, { joinedAt: 'asc' }],
        },
      },
    });

    return user ? this.mapUser(user) : null;
  }

  async updateProfile(userId: string, input: UpdateUserProfileInput): Promise<UserProfile> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: input.fullName?.trim(),
        phone: input.phone?.trim(),
        profilePhotoUrl: input.profilePhotoUrl?.trim(),
      },
      include: {
        memberships: {
          include: {
            institution: true,
          },
          orderBy: [{ isDefault: 'desc' }, { joinedAt: 'asc' }],
        },
      },
    }).catch(() => null);

    if (!user) {
      throw new NotFoundException('The requested user was not found.');
    }

    return this.mapUser(user);
  }

  private mapUser(user: {
    id: string;
    email: string;
    fullName: string;
    phone: string | null;
    documentType: DocumentType;
    documentNumber: string;
    profilePhotoUrl: string | null;
    globalRole: GlobalUserRole;
    accountStatus: AccountStatus;
    emailVerifiedAt: Date | null;
    memberships: {
      id: string;
      institutionId: string;
      role: MembershipRole;
      membershipStatus: MembershipStatus;
      studentCode: string;
      isDefault: boolean;
      driverVerificationStatus: DriverVerificationStatus;
      institution: { name: string };
    }[];
  }): UserProfile {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      documentType: user.documentType,
      documentNumber: user.documentNumber,
      profilePhotoUrl: user.profilePhotoUrl,
      globalRole: user.globalRole as unknown as SharedGlobalUserRole,
      accountStatus: user.accountStatus as unknown as SharedAccountStatus,
      emailVerifiedAt: user.emailVerifiedAt,
      memberships: user.memberships.map((membership) => ({
        id: membership.id,
        institutionId: membership.institutionId,
        institutionName: membership.institution.name,
        role: membership.role as unknown as InstitutionMembershipRole,
        membershipStatus: membership.membershipStatus as unknown as SharedMembershipStatus,
        studentCode: membership.studentCode,
        isDefault: membership.isDefault,
        driverVerificationStatus:
          membership.driverVerificationStatus as unknown as SharedDriverVerificationStatus,
      })),
    };
  }
}