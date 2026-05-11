'use client';

import {
  GlobalUserRole,
  InstitutionMembershipRole,
  isOperationalMembership,
} from '@saferidepro/shared-types';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '../../../components/ui/button';
import { InputField } from '../../../components/ui/input-field';
import { SelectField } from '../../../components/ui/select-field';
import { StatusPill } from '../../../components/ui/status-pill';
import { ToastItem, ToastStack } from '../../../components/ui/toast-stack';
import { useAutoRefresh } from '../../../hooks/use-auto-refresh';
import { ApiError } from '../../../lib/api-client';
import { useAuth } from '../../../modules/auth/hooks/use-auth';
import { listAuditEvents } from '../../../modules/audit/lib/audit-api';
import { getAuditActionLabel, getAuditEntityTypeLabel } from '../../../modules/audit/lib/audit-labels';
import {
  AUDIT_ACTIONS,
  AUDIT_ENTITY_TYPES,
  type AuditEventRecord,
  type AuditFilters,
} from '../../../modules/audit/types/audit';
import styles from './page.module.css';

const EMPTY_FILTERS: AuditFilters = {
  institutionId: undefined,
  action: undefined,
  entityType: undefined,
  from: undefined,
  to: undefined,
  limit: '50',
};

const PAGE_SIZE = 10;

function toIsoDateTime(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate.toISOString();
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('es-EC');
}

function getApiErrorMessage(error: unknown, fallbackMessage: string): string {
  return error instanceof ApiError ? error.message : fallbackMessage;
}

function formatMetadataValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'No disponible';
  }

  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'bigint'
  ) {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.length ? value.map((item) => formatMetadataValue(item)).join(', ') : 'Sin elementos';
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>);
    return keys.length ? `Objeto con ${keys.length} campos` : 'Objeto vacio';
  }

  return String(value);
}

function extractMetadataEntries(metadata: Record<string, unknown> | null) {
  if (!metadata) {
    return [];
  }

  return Object.entries(metadata).map(([key, value]) => ({
    key,
    value: formatMetadataValue(value),
  }));
}

type IconName = 'event' | 'refresh' | 'detail' | 'filter';

function InlineIcon({ name, className }: { name: IconName; className?: string }) {
  const iconProps = {
    className: className ?? styles.icon,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (name) {
    case 'event':
      return (
        <svg {...iconProps}>
          <path d="M4 12h4l2-4 4 8 2-4h4" />
        </svg>
      );
    case 'refresh':
      return (
        <svg {...iconProps}>
          <path d="M20 6v6h-6" />
          <path d="M20 12a8 8 0 1 1-2.34-5.66" />
        </svg>
      );
    case 'detail':
      return (
        <svg {...iconProps}>
          <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      );
    case 'filter':
      return (
        <svg {...iconProps}>
          <path d="M4 5h16l-6 7v6l-4 2v-8z" />
        </svg>
      );
    default:
      return null;
  }
}

function StatChip({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className={styles.statCard}>
      <span className={styles.statCardLabel}>{label}</span>
      <strong className={styles.statCardValue}>{value}</strong>
    </div>
  );
}

type PaginationProps = {
  page: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPrev: () => void;
  onNext: () => void;
};

function PaginationBar({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPrev,
  onNext,
}: PaginationProps) {
  if (totalItems <= pageSize) {
    return null;
  }

  const start = Math.min(totalItems, (page - 1) * pageSize + 1);
  const end = Math.min(totalItems, page * pageSize);

  return (
    <div className={styles.pagination}>
      <span className={styles.paginationInfo}>
        Mostrando <strong>{start}-{end}</strong> de <strong>{totalItems}</strong> resultados
      </span>
      <div className={styles.paginationActions}>
            <button className={styles.paginationBtn} disabled={page <= 1} onClick={onPrev} type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Anterior
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: '0 0.5rem' }}>
              <span className={styles.pageNumber}>{page}</span>
              <span className={styles.pageDivider}>de</span>
              <span className={styles.pageNumberTotal}>{totalPages}</span>
            </div>
            <button className={styles.paginationBtn} disabled={page >= totalPages} onClick={onNext} type="button">
          Siguiente
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
      </div>
    </div>
  );
}

export default function AuditPage() {
  const { authSession, isHydrated, refreshSession } = useAuth();
  const [auditEvents, setAuditEvents] = useState<AuditEventRecord[]>([]);
  const [filterValues, setFilterValues] = useState<AuditFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<AuditFilters>(EMPTY_FILTERS);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [activeEvent, setActiveEvent] = useState<AuditEventRecord | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const adminMemberships = useMemo(
    () =>
      authSession?.user.memberships.filter(
        (membership) =>
          membership.role === InstitutionMembershipRole.InstitutionAdmin &&
          isOperationalMembership(membership),
      ) ?? [],
    [authSession],
  );

  const canAccessAdminView = Boolean(
    authSession &&
      (
        authSession.user.globalRole === GlobalUserRole.SuperAdmin ||
        adminMemberships.length > 0
      ),
  );

  const institutionOptions = adminMemberships.map((membership) => ({
    id: membership.institutionId,
    name: membership.institutionName,
  }));

  const pushToast = (
    title: string,
    description: string,
    tone: ToastItem['tone'] = 'info',
  ) => {
    setToasts((currentToasts) => [
      ...currentToasts,
      {
        id: `audit-events-toast-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title,
        description,
        tone,
      },
    ]);
  };

  const dismissToast = (toastId: string) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== toastId));
  };

  const loadEvents = async (accessToken: string, filters: AuditFilters) => {
    const items = await listAuditEvents(accessToken, filters);
    setAuditEvents(items);
  };

  const refreshEvents = async (showSpinner = false) => {
    if (!authSession || !canAccessAdminView) {
      return;
    }

    if (showSpinner) {
      setIsRefreshing(true);
    }

    try {
      await loadEvents(authSession.accessToken, appliedFilters);

      if (showSpinner) {
        pushToast('Auditoria actualizada', 'La trazabilidad visible ya esta al dia.', 'success');
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      pushToast(
        'No se pudo actualizar',
        getApiErrorMessage(error, 'No fue posible sincronizar la trazabilidad.'),
        'error',
      );
    } finally {
      if (showSpinner) {
        setIsRefreshing(false);
      }
    }
  };

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!authSession) {
      setIsLoading(false);
      return;
    }

    if (!canAccessAdminView) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const initialize = async () => {
      setIsLoading(true);

      try {
        await loadEvents(authSession.accessToken, appliedFilters);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof ApiError && error.status === 403) {
          await refreshSession().catch(() => undefined);
        }

        pushToast(
          'No se pudo cargar',
          getApiErrorMessage(error, 'No fue posible cargar la auditoria.'),
          'error',
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void initialize();

    return () => {
      isMounted = false;
    };
  }, [appliedFilters, authSession, canAccessAdminView, isHydrated, refreshSession]);

  useAutoRefresh(
    async () => {
      await refreshEvents();
    },
    {
      enabled: Boolean(authSession && isHydrated && canAccessAdminView),
      intervalMs: 20_000,
    },
  );

  const handleFilterChange = (field: keyof AuditFilters, value: string) => {
    setFilterValues((current) => ({
      ...current,
      [field]: value === '' ? undefined : value,
    }));
  };

  const handleApplyFilters = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsApplyingFilters(true);
    setPage(1);

    setAppliedFilters({
      institutionId: filterValues.institutionId,
      action: filterValues.action,
      entityType: filterValues.entityType,
      from: toIsoDateTime(filterValues.from),
      to: toIsoDateTime(filterValues.to),
      limit: filterValues.limit ?? '50',
    });

    setIsApplyingFilters(false);
  };

  const handleResetFilters = () => {
    setFilterValues(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const activeFiltersCount = [
    appliedFilters.institutionId,
    appliedFilters.action,
    appliedFilters.entityType,
    appliedFilters.from,
    appliedFilters.to,
  ].filter(Boolean).length;

  const uniqueActionCount = new Set(auditEvents.map((event) => event.action)).size;
  const uniqueActorCount = new Set(
    auditEvents.map((event) => event.actorFullName ?? 'Sistema'),
  ).size;
  const pageCount = Math.max(1, Math.ceil(auditEvents.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const paginatedEvents = auditEvents.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const eventStats = [
    {
      label: 'Eventos',
      value: auditEvents.length,
    },
    {
      label: 'Acciones',
      value: uniqueActionCount,
    },
    {
      label: 'Actores',
      value: uniqueActorCount,
    },
    {
      label: 'Filtros',
      value: activeFiltersCount,
    },
  ];

  if (isLoading) {
    return (
      <>
        <ToastStack onDismiss={dismissToast} toasts={toasts} />
        <section className={styles.loadingShell}>
          <article className={styles.stateCard}>
            <div aria-hidden="true" className={styles.loadingPulse} />
            <h1 className={styles.stateTitle}>Cargando auditoria</h1>
            <p className={styles.stateText}>Preparando la trazabilidad institucional.</p>
          </article>
        </section>
      </>
    );
  }

  if (!canAccessAdminView) {
    return (
      <>
        <ToastStack onDismiss={dismissToast} toasts={toasts} />
        <section className={styles.page}>
          <header className={styles.dashboardHeader}>
            <h1 className={styles.headerTitle}>Auditoría (Acceso Restringido)</h1>
          </header>

          <section className={styles.emptyState}>
            <h2 className={styles.emptyTitle}>Permisos insuficientes</h2>
            <p className={styles.emptyText}>
              Tu sesion actual no tiene permisos administrativos para consultar los eventos del sistema.
            </p>
          </section>
        </section>
      </>
    );
  }

  return (
    <>
      <ToastStack onDismiss={dismissToast} toasts={toasts} />

      <section className={styles.page}>
        <header className={styles.dashboardHeader}>
          <h1 className={styles.headerTitle}>Trazabilidad Institucional</h1>
          <Button
            disabled={isRefreshing}
            onClick={() => void refreshEvents(true)}
            variant="secondary"
          >
            <span className={styles.buttonIcon}>
              <InlineIcon className={styles.icon} name="refresh" />
            </span>
            {isRefreshing ? 'Actualizando...' : 'Actualizar Datos'}
          </Button>
        </header>

        <form className={styles.filtersBar} onSubmit={handleApplyFilters}>
          <SelectField
            label="Institución"
            onChange={(event) => handleFilterChange('institutionId', event.target.value)}
            value={filterValues.institutionId ?? ''}
          >
            <option value="">Todas las accesibles</option>
            {institutionOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Acción"
            onChange={(event) => handleFilterChange('action', event.target.value)}
            value={filterValues.action ?? ''}
          >
            <option value="">Todas</option>
            {AUDIT_ACTIONS.map((action) => (
              <option key={action} value={action}>
                {getAuditActionLabel(action)}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Tipo de Entidad"
            onChange={(event) => handleFilterChange('entityType', event.target.value)}
            value={filterValues.entityType ?? ''}
          >
            <option value="">Todas</option>
            {AUDIT_ENTITY_TYPES.map((entityType) => (
              <option key={entityType} value={entityType}>
                {getAuditEntityTypeLabel(entityType)}
              </option>
            ))}
          </SelectField>

          <InputField
            label="Desde"
            onChange={(event) => handleFilterChange('from', event.target.value)}
            type="datetime-local"
            value={filterValues.from ?? ''}
          />

          <InputField
            label="Hasta"
            onChange={(event) => handleFilterChange('to', event.target.value)}
            type="datetime-local"
            value={filterValues.to ?? ''}
          />

          <SelectField
            label="Límite"
            onChange={(event) => handleFilterChange('limit', event.target.value)}
            value={filterValues.limit ?? '50'}
          >
            <option value="25">25 eventos</option>
            <option value="50">50 eventos</option>
            <option value="100">100 eventos</option>
          </SelectField>

          <div className={styles.filterActions}>
            <Button disabled={isApplyingFilters} type="submit">
              Aplicar filtros
            </Button>
            {activeFiltersCount > 0 && (
              <Button disabled={isApplyingFilters} onClick={handleResetFilters} type="button" variant="ghost">
                Limpiar
              </Button>
            )}
          </div>
        </form>

        <div className={styles.statsRow}>
          {eventStats.map((stat) => (
            <StatChip
              key={stat.label}
              label={stat.label}
              value={stat.value}
            />
          ))}
        </div>

        <div className={styles.tableContainer}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Acción Realizada</th>
                <th>Actor y Fecha</th>
                <th>Entidad Afectada</th>
                <th>Institución</th>
                <th className={styles.actionsCell}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginatedEvents.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className={styles.emptyState}>
                      <h3 className={styles.emptyTitle}>Sin resultados</h3>
                      <p>No hay eventos registrados para los filtros de búsqueda actuales.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedEvents.map((event) => (
                  <tr key={event.id}>
                    <td>
                      <span className={styles.tdPrimary}>{getAuditActionLabel(event.action)}</span>
                    </td>
                    <td>
                      <span className={styles.tdPrimary}>{event.actorFullName ?? 'Sistema'}</span>
                      <span className={styles.tdSecondary}>{formatDateTime(event.createdAt)}</span>
                    </td>
                    <td>
                      <span className={styles.tdPrimary}>{getAuditEntityTypeLabel(event.entityType)}</span>
                      <span className={styles.tdSecondary}>{event.entityId ?? 'Sin referencia'}</span>
                    </td>
                    <td>{event.institutionName ?? 'Global / No aplica'}</td>
                    <td className={styles.actionsCell}>
                      <Button onClick={() => setActiveEvent(event)} variant="secondary">
                        Detalle
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <PaginationBar
            onNext={() => setPage((current) => Math.min(pageCount, current + 1))}
            onPrev={() => setPage((current) => Math.max(1, current - 1))}
            page={safePage}
            pageSize={PAGE_SIZE}
            totalItems={auditEvents.length}
            totalPages={pageCount}
          />
        </div>
      </section>

      {activeEvent ? (
        <div
          className={styles.modalOverlay}
          role="presentation"
        >
          <div
            aria-labelledby="audit-event-modal-title"
            aria-modal="true"
            className={styles.modalCard}
            role="dialog"
          >
            <div className={styles.modalHeader}>
              <div>
                <h2 className={styles.modalTitle} id="audit-event-modal-title">
                  {getAuditActionLabel(activeEvent.action)}
                </h2>
                <p className={styles.modalSubtitle}>
                  Por {activeEvent.actorFullName ?? 'Sistema'} &bull; {formatDateTime(activeEvent.createdAt)}
                </p>
              </div>
              <button
                aria-label="Cerrar detalle"
                className={styles.modalClose}
                onClick={() => setActiveEvent(null)}
                type="button"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                </svg>
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.modalSection}>
                <h3 className={styles.modalSectionTitle}>Información de Entidad</h3>
                <div className={styles.modalField}>
                  <span className={styles.modalFieldLabel}>Tipo de Entidad</span>
                  <span className={styles.modalFieldValue}>{getAuditEntityTypeLabel(activeEvent.entityType)}</span>
                </div>
                <div className={styles.modalField}>
                  <span className={styles.modalFieldLabel}>Identificador de Entidad</span>
                  <span className={styles.modalFieldValue}>{activeEvent.entityId ?? 'Sin referencia'}</span>
                </div>
                <div className={styles.modalField}>
                  <span className={styles.modalFieldLabel}>Institución Involucrada</span>
                  <span className={styles.modalFieldValue}>{activeEvent.institutionName ?? 'Global / No aplica'}</span>
                </div>
              </div>

              <div className={styles.modalSection}>
                <h3 className={styles.modalSectionTitle}>Metadatos Adicionales</h3>
                {extractMetadataEntries(activeEvent.metadata).length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                    {extractMetadataEntries(activeEvent.metadata).map((entry) => (
                      <div key={`${activeEvent.id}-${entry.key}`} className={styles.modalField}>
                        <span className={styles.modalFieldLabel}>{entry.key}</span>
                        <span className={styles.modalNote}>{entry.value}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={styles.modalNote}>Sin metadatos adicionales en este evento.</div>
                )}
              </div>
            </div>

            <div className={styles.modalFooter}>
              <Button onClick={() => setActiveEvent(null)} variant="ghost">Cerrar</Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
