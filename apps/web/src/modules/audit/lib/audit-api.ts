import { apiRequest } from '../../../lib/api-client';
import type { AuditEventRecord, AuditFilters } from '../types/audit';

type AuditListResponse = {
  items: AuditEventRecord[];
};

export async function listAuditEvents(
  accessToken: string,
  filters: AuditFilters = {},
): Promise<AuditEventRecord[]> {
  const response = await apiRequest<AuditListResponse>('/audit/events', {
    accessToken,
    searchParams: {
      institutionId: filters.institutionId,
      action: filters.action,
      entityType: filters.entityType,
      from: filters.from,
      to: filters.to,
      limit: filters.limit,
    },
  });

  return response.items;
}
