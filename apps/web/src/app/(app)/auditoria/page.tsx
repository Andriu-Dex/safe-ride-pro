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

export default function AuditPage() {
  const { authSession, isHydrated, refreshSession } = useAuth();
  const [auditEvents, setAuditEvents] = useState<AuditEventRecord[]>([]);
  const [filterValues, setFilterValues] = useState<AuditFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<AuditFilters>(EMPTY_FILTERS);
  const [expandedEventIds, setExpandedEventIds] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);
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
  };

  const toggleEventExpanded = (eventId: string) => {
    setExpandedEventIds((current) => ({
      ...current,
      [eventId]: !current[eventId],
    }));
  };

  const activeFiltersCount = [
    appliedFilters.institutionId,
    appliedFilters.action,
    appliedFilters.entityType,
    appliedFilters.from,
    appliedFilters.to,
  ].filter(Boolean).length;

  if (isLoading) {
    return (
      <>
        <ToastStack onDismiss={dismissToast} toasts={toasts} />
        <section className={styles.loadingShell}>
          <article className={styles.loadingCard}>
            <div aria-hidden="true" className={styles.loadingPulse} />
            <h1 className={styles.loadingTitle}>Cargando auditoria</h1>
            <p className={styles.loadingText}>
              Estamos preparando la trazabilidad institucional.
            </p>
          </article>
        </section>
      </>
    );
  }

  if (!canAccessAdminView) {
    return (
      <>
        <ToastStack onDismiss={dismissToast} toasts={toasts} />
        <section className={styles.auditShell}>
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

      <section className={styles.auditShell}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>Auditoria</p>
            <h1 className={styles.heroTitle}>Trazabilidad institucional</h1>
            <p className={styles.heroLead}>
              Consulta eventos administrativos y del sistema para entender que ocurrio, quien lo hizo y en que contexto.
            </p>
          </div>

          <div className={styles.heroActions}>
            <StatusPill
              label={auditEvents.length ? `${auditEvents.length} eventos visibles` : 'Sin eventos'}
              tone={auditEvents.length ? 'neutral' : 'success'}
            />
            <Button
              disabled={isRefreshing}
              onClick={() => void refreshEvents(true)}
              variant="secondary"
            >
              {isRefreshing ? 'Actualizando...' : 'Actualizar'}
            </Button>
          </div>
        </section>

        <div className={styles.auditLayout}>
          <aside className={styles.sidebar}>
            <section className={styles.sidebarSection}>
              <div className={styles.sidebarSectionHeader}>
                <div>
                  <p className={styles.sidebarKicker}>Filtros</p>
                  <h2 className={styles.sidebarTitle}>Consulta actual</h2>
                </div>
                {activeFiltersCount ? (
                  <span className={styles.filterBadge}>{activeFiltersCount} activos</span>
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

          <div className={styles.contentShell}>
            <section className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionKicker}>Eventos</p>
                <h2 className={styles.sectionTitle}>Historial visible</h2>
              </div>
            </section>

            <div className={styles.workspaceSurface}>
              {auditEvents.length ? (
                <div className="list-stack">
                  {auditEvents.map((event) => {
                    const isExpanded = Boolean(expandedEventIds[event.id]);
                    const metadataEntries = extractMetadataEntries(event.metadata);

                    return (
                      <article key={event.id} className="list-card">
                        <div className="list-card-header">
                          <strong>{getAuditActionLabel(event.action)}</strong>
                          <div className="button-row">
                            <StatusPill
                              label={getAuditEntityTypeLabel(event.entityType)}
                              tone="neutral"
                            />
                            <Button onClick={() => toggleEventExpanded(event.id)} variant="ghost">
                              {isExpanded ? 'Ocultar detalle' : 'Ver detalle'}
                            </Button>
                          </div>
                        </div>

                        <p className="panel-text">
                          Actor: {event.actorFullName ?? 'Sistema'} | Fecha: {formatDateTime(event.createdAt)}
                        </p>

                        <p className="panel-text">
                          Institucion: {event.institutionName ?? 'No aplica'} | Entidad: {event.entityId ?? 'Sin referencia'}
                        </p>

                        {isExpanded ? (
                          metadataEntries.length ? (
                            <div className="audit-metadata-grid">
                              {metadataEntries.map((entry) => (
                                <div key={`${event.id}-${entry.key}`} className="audit-metadata-item">
                                  <span>{entry.key}</span>
                                  <strong>{entry.value}</strong>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="panel-text">Este evento no incluye metadatos adicionales.</p>
                          )
                        ) : (
                          <p className="panel-text">Abre el detalle solo cuando necesites mas contexto.</p>
                        )}
                      </article>
                    );
                  })}
                </div>
              ) : (
                <section className={styles.emptyState}>
                  <h2 className={styles.emptyTitle}>Sin resultados</h2>
                  <p className={styles.emptyText}>
                    No hay eventos para los filtros actuales. Ajusta la fecha, la accion o la institucion para ampliar la consulta.
                  </p>
                </section>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
