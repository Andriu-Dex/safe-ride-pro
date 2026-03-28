import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

import { PrismaService } from '../../../../shared/infrastructure/database/prisma.service';
import {
  AuditEventFilters,
  AuditEventRecord,
  AuditJsonObject,
  AuditRepository,
  CreateAuditEventInput,
} from '../../application/ports/audit.repository';
import { AuditAction, AuditEntityType } from '../../domain/audit.types';

@Injectable()
export class PrismaAuditRepository implements AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get client(): PrismaClient {
    return this.prisma as PrismaClient;
  }

  async createEvent(input: CreateAuditEventInput): Promise<void> {
    await this.client.auditEvent.create({
      data: {
        institutionId: input.institutionId,
        actorUserId: input.actorUserId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata as Prisma.InputJsonObject | undefined,
      },
    });
  }

  async listEvents(filters: AuditEventFilters): Promise<AuditEventRecord[]> {
    const events = await this.client.auditEvent.findMany({
      where: {
        institutionId: filters.institutionIds ? { in: filters.institutionIds } : undefined,
        actorUserId: filters.actorUserId,
        action: filters.action,
        entityType: filters.entityType,
        createdAt: {
          gte: filters.from,
          lte: filters.to,
        },
      },
      include: {
        institution: true,
        actorUser: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: filters.limit ?? 50,
    });

    return events.map((eventRecord) => this.mapEvent(eventRecord));
  }

  private mapEvent(eventRecord: {
    id: string;
    institutionId: string | null;
    actorUserId: string | null;
    action: string;
    entityType: string;
    entityId: string | null;
    metadata: unknown;
    createdAt: Date;
    institution: { name: string } | null;
    actorUser: { fullName: string } | null;
  }): AuditEventRecord {
    return {
      id: eventRecord.id,
      institutionId: eventRecord.institutionId,
      institutionName: eventRecord.institution?.name ?? null,
      actorUserId: eventRecord.actorUserId,
      actorFullName: eventRecord.actorUser?.fullName ?? null,
      action: eventRecord.action as AuditAction,
      entityType: eventRecord.entityType as AuditEntityType,
      entityId: eventRecord.entityId,
      metadata: this.normalizeMetadata(eventRecord.metadata),
      createdAt: eventRecord.createdAt,
    };
  }

  private normalizeMetadata(metadata: unknown): AuditJsonObject | null {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
      return null;
    }

    return metadata as AuditJsonObject;
  }
}
