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

type StatTone = 'neutral' | 'warning' | 'danger' | 'success';

const STAT_TONE_CLASSES: Record<StatTone, string> = {
  neutral: '',
  warning: styles.statChipWarning,
  danger: styles.statChipDanger,
  success: styles.statChipSuccess,
};

function StatChip({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string | number;
  tone?: StatTone;
}) {
  return (
    <div className={[styles.statChip, STAT_TONE_CLASSES[tone]].filter(Boolean).join(' ')}>
      <span className={styles.statLabel}>{label}</span>
      <strong className={styles.statValue}>{value}</strong>
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
        Mostrando {start}-{end} de {totalItems}
      </span>
      <div className={styles.paginationActions}>
        <Button disabled={page <= 1} onClick={onPrev} variant="ghost">
          Anterior
        </Button>
        <span className={styles.paginationLabel}>
          {page}/{totalPages}
        </span>
        <Button disabled={page >= totalPages} onClick={onNext} variant="ghost">
          Siguiente
        </Button>
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
      tone: auditEvents.length ? 'neutral' : 'neutral',
    },
    {
      label: 'Acciones',
      value: uniqueActionCount,
      tone: uniqueActionCount ? 'neutral' : 'neutral',
    },
    {
      label: 'Actores',
      value: uniqueActorCount,
      tone: uniqueActorCount ? 'neutral' : 'neutral',
    },
    {
      label: 'Filtros',
      value: activeFiltersCount,
      tone: activeFiltersCount ? 'warning' : 'neutral',
    },
  ] as const;

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
          <section className={styles.hero}>
            <div className={styles.heroCopy}>
              <p className={styles.kicker}>Auditoria</p>
              <h1 className={styles.heroTitle}>Trazabilidad institucional</h1>
              <p className={styles.heroLead}>
                Esta vista solo esta disponible para administradores institucionales y superadministracion.
              </p>
            </div>
            <StatusPill label="Acceso restringido" tone="warning" />
          </section>

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
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>Auditoria</p>
            <h1 className={styles.heroTitle}>Trazabilidad institucional</h1>
            <p className={styles.heroLead}>
              Consulta eventos administrativos y del sistema con filtros claros y un detalle rapido.
            </p>
          </div>

          <div className={styles.heroActions}>
            <div className={styles.heroChips}>
              <span className={styles.heroChip}>
                <InlineIcon className={styles.iconSmall} name="event" />
                {auditEvents.length} eventos
              </span>
            </div>
            <Button
              disabled={isRefreshing}
              onClick={() => void refreshEvents(true)}
              variant="secondary"
            >
              <span className={styles.buttonIcon}>
                <InlineIcon className={styles.iconSmall} name="refresh" />
              </span>
              {isRefreshing ? 'Actualizando...' : 'Actualizar'}
            </Button>
          </div>
        </section>

        <div className={styles.board}>
          <aside className={styles.rail}>
            <section className={styles.railSection}>
              <div className={styles.railHeader}>
                <div>
                  <p className={styles.railLabel}>Filtros</p>
                  <h2 className={styles.railTitle}>Consulta</h2>
                </div>
                {activeFiltersCount ? (
                  <span className={styles.filterBadge}>{activeFiltersCount}</span>
                ) : null}
              </div>

              <form className={styles.filterForm} onSubmit={handleApplyFilters}>
                <SelectField
                  label="Institucion"
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
                  label="Accion"
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
                  label="Entidad"
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
                  label="Limite"
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
                  <Button disabled={isApplyingFilters} onClick={handleResetFilters} type="button" variant="ghost">
                    Limpiar
                  </Button>
                </div>
              </form>
            </section>
          </aside>

          <main className={styles.content}>
            <header className={styles.contentHeader}>
              <div>
                <p className={styles.contentKicker}>Eventos</p>
                <h2 className={styles.contentTitle}>Historial visible</h2>
                <p className={styles.contentSubtitle}>Revisa la actividad administrativa mas reciente.</p>
              </div>
            </header>

            <div className={styles.statsRow}>
              {eventStats.map((stat) => (
                <StatChip
                  key={stat.label}
                  label={stat.label}
                  tone={stat.tone}
                  value={stat.value}
                />
              ))}
            </div>

            {paginatedEvents.length ? (
              <div className={styles.list}>
                {paginatedEvents.map((event, index) => (
                  <div
                    key={event.id}
                    className={styles.listRow}
                    style={{ animationDelay: `${index * 0.04}s` }}
                  >
                    <div className={styles.rowMain}>
                      <div className={styles.rowTitle}>{getAuditActionLabel(event.action)}</div>
                      <div className={styles.rowMeta}>
                        {event.actorFullName ?? 'Sistema'} | {formatDateTime(event.createdAt)}
                      </div>
                    </div>
                    <div className={styles.rowBadges}>
                      <StatusPill
                        label={getAuditEntityTypeLabel(event.entityType)}
                        tone="neutral"
                      />
                    </div>
                    <div className={styles.rowInfo}>
                      <span>{event.institutionName ?? 'No aplica'}</span>
                      <span>{event.entityId ?? 'Sin referencia'}</span>
                    </div>
                    <div className={styles.rowActions}>
                      <Button onClick={() => setActiveEvent(event)} variant="secondary">
                        <span className={styles.buttonIcon}>
                          <InlineIcon className={styles.iconSmall} name="detail" />
                        </span>
                        Detalle
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <section className={styles.emptyState}>
                <h2 className={styles.emptyTitle}>Sin resultados</h2>
                <p className={styles.emptyText}>
                  No hay eventos para los filtros actuales. Ajusta la fecha o la accion para ampliar la consulta.
                </p>
              </section>
            )}

            <PaginationBar
              onNext={() => setPage((current) => Math.min(pageCount, current + 1))}
              onPrev={() => setPage((current) => Math.max(1, current - 1))}
              page={safePage}
              pageSize={PAGE_SIZE}
              totalItems={auditEvents.length}
              totalPages={pageCount}
            />
          </main>
        </div>
      </section>

      {activeEvent ? (
        <div
          aria-labelledby="audit-event-modal-title"
          aria-modal="true"
          className="modal-backdrop"
          onClick={() => setActiveEvent(null)}
          role="dialog"
        >
          <div
            className={`modal-card modal-card-lg ${styles.modalCard}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div>
                <p className={styles.modalKicker}>Evento</p>
                <h2 className={styles.modalTitle} id="audit-event-modal-title">
                  {getAuditActionLabel(activeEvent.action)}
                </h2>
                <p className={styles.modalSubtitle}>
                  {activeEvent.actorFullName ?? 'Sistema'} | {formatDateTime(activeEvent.createdAt)}
                </p>
              </div>
              <Button onClick={() => setActiveEvent(null)} variant="ghost">
                Cerrar
              </Button>
            </div>

            <div className={styles.modalBadgeRow}>
              <StatusPill
                label={getAuditEntityTypeLabel(activeEvent.entityType)}
                tone="neutral"
              />
            </div>

            <div className={styles.modalGrid}>
              <div className={styles.modalField}>
                <span className={styles.modalFieldLabel}>Institucion</span>
                <strong className={styles.modalFieldValue}>
                  {activeEvent.institutionName ?? 'No aplica'}
                </strong>
              </div>
              <div className={styles.modalField}>
                <span className={styles.modalFieldLabel}>Entidad</span>
                <strong className={styles.modalFieldValue}>
                  {activeEvent.entityId ?? 'Sin referencia'}
                </strong>
              </div>
            </div>

            <div className={styles.modalStack}>
              {extractMetadataEntries(activeEvent.metadata).length ? (
                <div className={styles.modalGrid}>
                  {extractMetadataEntries(activeEvent.metadata).map((entry) => (
                    <div key={`${activeEvent.id}-${entry.key}`} className={styles.modalField}>
                      <span className={styles.modalFieldLabel}>{entry.key}</span>
                      <strong className={styles.modalFieldValue}>{entry.value}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p className={styles.modalNoteMuted}>Sin metadatos adicionales.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
