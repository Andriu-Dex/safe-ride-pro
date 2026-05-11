'use client';

import {
  AccountStatus,
  DriverVerificationStatus,
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
import { canAccessAudit } from '../../../modules/audit/lib/audit-access';
import { useAuth } from '../../../modules/auth/hooks/use-auth';
import {
  getDriverLicenseStatusLabel,
  getDriverLicenseStatusTone,
  getDriverStatusLabel,
  getDriverStatusTone,
} from '../../../modules/driver/lib/driver-status';
import {
  listAdminUserDirectory,
  updateAdminUserAccountStatus,
} from '../../../modules/users/lib/user-api';
import type { AdminUserDirectoryRecord } from '../../../modules/users/types/admin-user-directory';
import styles from './page.module.css';

const PAGE_SIZE = 10;

function getApiErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof ApiError) {
    if (error.message.includes('uuid is expected')) {
      return 'El identificador del usuario es inválido o no se encontró (se esperaba un formato UUID válido).';
    }
    return error.message;
  }
  return fallbackMessage;
}

function getAccountStatusLabel(status: AccountStatus): string {
  switch (status) {
    case AccountStatus.Active:
      return 'Activa';
    case AccountStatus.Suspended:
      return 'Bloqueada';
    case AccountStatus.PendingEmailVerification:
      return 'Pendiente';
    default:
      return status;
  }
}

function getAccountStatusTone(
  status: AccountStatus,
): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case AccountStatus.Active:
      return 'success';
    case AccountStatus.Suspended:
      return 'danger';
    case AccountStatus.PendingEmailVerification:
      return 'warning';
    default:
      return 'neutral';
  }
}

function getGlobalRoleLabel(role: GlobalUserRole): string {
  switch (role) {
    case GlobalUserRole.SuperAdmin:
      return 'Super administrador';
    case GlobalUserRole.User:
      return 'Usuario';
    default:
      return role;
  }
}

function getMembershipRoleLabel(role: InstitutionMembershipRole): string {
  return role === InstitutionMembershipRole.InstitutionAdmin
    ? 'Administrador institucional'
    : 'Estudiante';
}

function formatDateTime(value: string | null): string {
  if (!value) {
    return 'No disponible';
  }

  return new Date(value).toLocaleString('es-EC');
}

function sumMembershipMetric(
  user: AdminUserDirectoryRecord,
  field: 'activeSanctionsCount' | 'activeBlockingSanctionsCount' | 'resolvedReportsReceivedCount',
): number {
  return user.memberships.reduce((total, membership) => total + membership[field], 0);
}

function getPrimaryInstitutionLabel(user: AdminUserDirectoryRecord): string {
  const primaryMembership = user.memberships.find((membership) => membership.isDefault)
    ?? user.memberships[0];

  return primaryMembership?.institutionName ?? 'Sin institucion';
}

function UserActionIcon({
  name,
  className,
}: {
  name: 'refresh' | 'lock' | 'unlock' | 'report' | 'sanction' | 'detail';
  className?: string;
}) {
  const iconProps = {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (name) {
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
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case 'lock':
      return (
        <svg {...iconProps}>
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      );
    case 'unlock':
      return (
        <svg {...iconProps}>
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 7-2.65" />
        </svg>
      );
    case 'report':
      return (
        <svg {...iconProps}>
          <path d="M12 3l9 16H3l9-16z" />
          <path d="M12 9v4" />
          <circle cx="12" cy="17" r="1" />
        </svg>
      );
    case 'sanction':
      return (
        <svg {...iconProps}>
          <path d="M2 21h7" />
          <path d="M6 13l5-5" />
          <path d="M8 15l4 4" />
          <path d="M12 6l4 4" />
          <path d="M13 5l4 4" />
        </svg>
      );
    default:
      return null;
  }
}

export default function AdminUsersPage() {
  const { authSession, isHydrated, refreshSession } = useAuth();
  const [users, setUsers] = useState<AdminUserDirectoryRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [institutionId, setInstitutionId] = useState('');
  const [accountStatus, setAccountStatus] = useState('');
  const [driverStatus, setDriverStatus] = useState('');
  const [fetchLimit, setFetchLimit] = useState('50');
  const [page, setPage] = useState(1);
  const [activeUser, setActiveUser] = useState<AdminUserDirectoryRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUpdatingUserId, setIsUpdatingUserId] = useState<string | null>(null);
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

  const institutionOptions = adminMemberships.map((membership) => ({
    id: membership.institutionId,
    name: membership.institutionName,
  }));

  const canAccessAdminView = canAccessAudit(authSession?.user);

  const pushToast = (
    title: string,
    description: string,
    tone: ToastItem['tone'] = 'info',
  ) => {
    setToasts((currentToasts) => [
      ...currentToasts,
      {
        id: `admin-users-toast-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title,
        description,
        tone,
      },
    ]);
  };

  const dismissToast = (toastId: string) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== toastId));
  };

  const loadUsers = async (accessToken: string) => {
    const items = await listAdminUserDirectory(accessToken, {
      institutionId: institutionId || undefined,
      query: searchQuery || undefined,
      accountStatus: accountStatus || undefined,
      driverVerificationStatus: driverStatus || undefined,
      limit: Number(fetchLimit),
    });

    setUsers(items);
  };

  const refreshUsers = async (showSpinner = false) => {
    if (!authSession || !canAccessAdminView) {
      return;
    }

    if (showSpinner) {
      setIsRefreshing(true);
    }

    try {
      await loadUsers(authSession.accessToken);

      if (showSpinner) {
        pushToast('Usuarios actualizados', 'La bandeja de cuentas ya esta al dia.', 'success');
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      pushToast(
        'No se pudo actualizar',
        getApiErrorMessage(error, 'No fue posible sincronizar los usuarios.'),
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
        await loadUsers(authSession.accessToken);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof ApiError && error.status === 403) {
          await refreshSession().catch(() => undefined);
        }

        pushToast(
          'No se pudo cargar',
          getApiErrorMessage(error, 'No fue posible cargar la bandeja de usuarios.'),
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
  }, [
    accountStatus,
    authSession,
    canAccessAdminView,
    driverStatus,
    fetchLimit,
    institutionId,
    isHydrated,
    refreshSession,
    searchQuery,
  ]);

  useAutoRefresh(
    async () => {
      await refreshUsers();
    },
    {
      enabled: Boolean(authSession && isHydrated && canAccessAdminView),
      intervalMs: 30_000,
    },
  );

  useEffect(() => {
    setPage(1);
  }, [accountStatus, driverStatus, fetchLimit, institutionId, searchQuery]);

  const handleResetFilters = () => {
    setSearchQuery('');
    setInstitutionId('');
    setAccountStatus('');
    setDriverStatus('');
    setFetchLimit('50');
  };

  const handleAccountStatusChange = async (
    userId: string,
    nextStatus: AccountStatus,
  ) => {
    if (!authSession) {
      return;
    }

    setIsUpdatingUserId(userId);

    try {
      const response = await updateAdminUserAccountStatus(
        authSession.accessToken,
        userId,
        nextStatus,
      );
      await loadUsers(authSession.accessToken);
      pushToast('Cuenta actualizada', response.message, 'success');

      if (activeUser?.userId === userId) {
        setActiveUser((currentUser) =>
          currentUser
            ? {
                ...currentUser,
                accountStatus: nextStatus,
              }
            : currentUser,
        );
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      pushToast(
        'No se pudo actualizar',
        getApiErrorMessage(error, 'No fue posible cambiar el estado de la cuenta.'),
        'error',
      );
    } finally {
      setIsUpdatingUserId(null);
    }
  };

  const activeFiltersCount = [
    searchQuery,
    institutionId,
    accountStatus,
    driverStatus,
    fetchLimit !== '50' ? fetchLimit : '',
  ].filter(Boolean).length;
  const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedUsers = users.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  if (isLoading) {
    return (
      <>
        <ToastStack onDismiss={dismissToast} toasts={toasts} />
        <section className={styles.loadingShell}>
          <article className={styles.stateCard}>
            <div aria-hidden="true" className={styles.loadingPulse} />
            <h1 className={styles.stateTitle}>Cargando usuarios</h1>
            <p className={styles.stateText}>
              Estamos preparando la bandeja administrativa de cuentas.
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
        <section className={styles.page}>
          <header className={styles.dashboardHeader}>
            <h1 className={styles.headerTitle}>Gestión de Usuarios (Acceso Restringido)</h1>
          </header>
        </section>
      </>
    );
  }

  return (
    <>
      <ToastStack onDismiss={dismissToast} toasts={toasts} />

      <section className={styles.page}>
        <header className={styles.dashboardHeader}>
          <h1 className={styles.headerTitle}>Gestión de Usuarios</h1>
          <Button
            disabled={isRefreshing}
            onClick={() => void refreshUsers(true)}
            variant="secondary"
          >
            <span className={styles.buttonIcon}>
              <UserActionIcon className={styles.icon} name="refresh" />
            </span>
            {isRefreshing ? 'Actualizando...' : 'Actualizar Datos'}
          </Button>
        </header>

        <div className={styles.filtersBar}>
          <InputField
            label="Buscar"
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Nombre, correo o documento"
            value={searchQuery}
          />

          <SelectField
            label="Institución"
            onChange={(event) => setInstitutionId(event.target.value)}
            value={institutionId}
          >
            <option value="">Todas las accesibles</option>
            {institutionOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Estado de cuenta"
            onChange={(event) => setAccountStatus(event.target.value)}
            value={accountStatus}
          >
            <option value="">Todos</option>
            <option value={AccountStatus.Active}>Activa</option>
            <option value={AccountStatus.Suspended}>Bloqueada</option>
            <option value={AccountStatus.PendingEmailVerification}>Pendiente</option>
          </SelectField>

          <SelectField
            label="Estado de conductor"
            onChange={(event) => setDriverStatus(event.target.value)}
            value={driverStatus}
          >
            <option value="">Todos</option>
            <option value={DriverVerificationStatus.PendingVerification}>Pendiente</option>
            <option value={DriverVerificationStatus.Approved}>Aprobado</option>
            <option value={DriverVerificationStatus.Rejected}>Rechazado</option>
            <option value={DriverVerificationStatus.Suspended}>Suspendido</option>
          </SelectField>

          <SelectField
            label="Carga inicial"
            onChange={(event) => setFetchLimit(event.target.value)}
            value={fetchLimit}
          >
            <option value="25">25 registros</option>
            <option value="50">50 registros</option>
            <option value="100">100 registros</option>
          </SelectField>

          <div className={styles.filterActions}>
            <Button onClick={() => setPage(1)}>Aplicar filtros</Button>
            {activeFiltersCount > 0 && (
              <Button onClick={handleResetFilters} variant="ghost">Limpiar</Button>
            )}
          </div>
        </div>

        <div className={styles.tableContainer}>
          <table className={styles.dataTable}>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Institución Principal</th>
                <th>Estado General</th>
                <th>Señales (Global)</th>
                <th className={styles.actionsCell}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <div className={styles.emptyState}>
                      <h3 className={styles.emptyTitle}>Sin resultados</h3>
                      <p>No se encontraron usuarios con los filtros actuales.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((user) => {
                  const blockingSanctions = sumMembershipMetric(user, 'activeBlockingSanctionsCount');
                  const resolvedReports = sumMembershipMetric(user, 'resolvedReportsReceivedCount');

                  return (
                    <tr key={user.userId} className={activeUser?.userId === user.userId ? styles.rowHighlight : ''}>
                      <td>
                        <div className={styles.userIdentity}>
                          <div className={styles.avatar}>
                            {user.profilePhotoUrl ? (
                              <img alt="" className={styles.avatarImage} src={user.profilePhotoUrl} />
                            ) : (
                              <span>{user.fullName.slice(0, 1).toUpperCase()}</span>
                            )}
                          </div>
                          <div className={styles.userMeta}>
                            <span className={styles.tdPrimary}>{user.fullName}</span>
                            <span className={styles.tdSecondary}>{user.email} &bull; {getGlobalRoleLabel(user.globalRole)}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className={styles.tdPrimary}>{getPrimaryInstitutionLabel(user)}</span>
                        <span className={styles.tdSecondary}>{user.memberships.length} membresía(s)</span>
                      </td>
                      <td>
                        <div className={styles.statusColumn}>
                          <StatusPill label={getAccountStatusLabel(user.accountStatus)} tone={getAccountStatusTone(user.accountStatus)} />
                          <StatusPill label={user.emailVerifiedAt ? 'Verificado' : 'Pendiente'} tone={user.emailVerifiedAt ? 'success' : 'warning'} />
                        </div>
                      </td>
                      <td>
                        <div className={styles.signalGroup}>
                          {blockingSanctions > 0 && (
                            <span className={styles.metricBadge}>
                              <UserActionIcon name="sanction" /> {blockingSanctions} bloqueos
                            </span>
                          )}
                          {resolvedReports > 0 && (
                            <span className={styles.metricBadge}>
                              <UserActionIcon name="report" /> {resolvedReports} reportes
                            </span>
                          )}
                          {blockingSanctions === 0 && resolvedReports === 0 && (
                            <span className={styles.tdSecondary}>Sin alertas</span>
                          )}
                        </div>
                      </td>
                      <td className={styles.actionsCell}>
                        <div className={styles.actionIconGroup}>
                          <button
                            className={styles.iconActionBtn}
                            onClick={() => setActiveUser(user)}
                            title="Ver detalle"
                            type="button"
                          >
                            <UserActionIcon className={styles.iconSmall} name="detail" />
                          </button>
                          {user.accountStatus === AccountStatus.Suspended ? (
                            <button
                              className={`${styles.iconActionBtn} ${styles.iconActionBtnSuccess}`}
                              disabled={isUpdatingUserId === user.userId}
                              onClick={() => void handleAccountStatusChange(user.userId, AccountStatus.Active)}
                              title="Reactivar cuenta"
                              type="button"
                            >
                              <UserActionIcon className={styles.iconSmall} name="unlock" />
                            </button>
                          ) : (
                            <button
                              className={`${styles.iconActionBtn} ${styles.iconActionBtnDanger}`}
                              disabled={isUpdatingUserId === user.userId}
                              onClick={() => void handleAccountStatusChange(user.userId, AccountStatus.Suspended)}
                              title="Bloquear cuenta"
                              type="button"
                            >
                              <UserActionIcon className={styles.iconSmall} name="lock" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <span className={styles.paginationInfo}>
                Mostrando {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(users.length, currentPage * PAGE_SIZE)} de {users.length}
              </span>
              <div className={styles.paginationActions}>
                <Button
                  disabled={currentPage <= 1}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                  variant="ghost"
                >
                  Anterior
                </Button>
                <span className={styles.paginationLabel}>
                  Página {currentPage} de {totalPages}
                </span>
                <Button
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                  variant="ghost"
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>

      {activeUser ? (
        <div className={styles.modalOverlay} role="presentation">
          <div
            aria-labelledby="admin-user-detail-title"
            aria-modal="true"
            className={styles.modalCard}
            role="dialog"
          >
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderProfile}>
                <div className={`${styles.avatar} ${styles.modalAvatar}`}>
                  {activeUser.profilePhotoUrl ? (
                    <img alt="" className={styles.avatarImage} src={activeUser.profilePhotoUrl} />
                  ) : (
                    <span>{activeUser.fullName.slice(0, 1).toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <h2 className={styles.modalTitle} id="admin-user-detail-title">
                    {activeUser.fullName}
                  </h2>
                </div>
              </div>
              <button
                aria-label="Cerrar detalle"
                className={styles.modalClose}
                onClick={() => setActiveUser(null)}
                type="button"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
                </svg>
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.modalSection}>
                <h3 className={styles.modalSectionTitle}>Información de la Cuenta</h3>
                <div className={styles.modalField}>
                  <span className={styles.modalFieldLabel}>Correo Electrónico</span>
                  <span className={styles.modalFieldValue}>{activeUser.email}</span>
                </div>
                <div className={styles.modalField}>
                  <span className={styles.modalFieldLabel}>Rol Global</span>
                  <span className={styles.modalFieldValue}>{getGlobalRoleLabel(activeUser.globalRole)}</span>
                </div>
                <div className={styles.modalField}>
                  <span className={styles.modalFieldLabel}>Estado de Cuenta</span>
                  <span className={styles.modalFieldValue}>{getAccountStatusLabel(activeUser.accountStatus)}</span>
                </div>
                <div className={styles.modalField}>
                  <span className={styles.modalFieldLabel}>Fecha de Registro</span>
                  <span className={styles.modalFieldValue}>{formatDateTime(activeUser.createdAt)}</span>
                </div>
              </div>

              <div className={styles.modalSection}>
                <h3 className={styles.modalSectionTitle}>Membresías Institucionales</h3>
                {activeUser.memberships.map((membership) => (
                  <div className={styles.membershipCard} key={membership.id}>
                    <div className={styles.membershipCardHeader}>
                      <strong>{membership.institutionName}</strong>
                      <span>
                        {getMembershipRoleLabel(membership.role)} | {membership.studentCode}
                      </span>
                    </div>

                    <div className={styles.statusGroup}>
                      <StatusPill
                        label={getDriverStatusLabel(
                          membership.effectiveDriverVerificationStatus
                          ?? membership.driverVerificationStatus,
                        )}
                        tone={getDriverStatusTone(
                          membership.effectiveDriverVerificationStatus
                          ?? membership.driverVerificationStatus,
                        )}
                      />
                      {membership.licenseStatus ? (
                        <StatusPill
                          label={getDriverLicenseStatusLabel(membership.licenseStatus)}
                          tone={getDriverLicenseStatusTone(membership.licenseStatus)}
                        />
                      ) : null}
                    </div>

                    <div className={styles.membershipMetrics}>
                      {membership.activeSanctionsCount > 0 && (
                        <span className={styles.metricBadge}><UserActionIcon name="sanction" /> {membership.activeSanctionsCount} sanciones</span>
                      )}
                      {membership.activeBlockingSanctionsCount > 0 && (
                        <span className={styles.metricBadge}><UserActionIcon name="lock" /> {membership.activeBlockingSanctionsCount} bloqueos</span>
                      )}
                      {membership.resolvedReportsReceivedCount > 0 && (
                        <span className={styles.metricBadge}><UserActionIcon name="report" /> {membership.resolvedReportsReceivedCount} reportes</span>
                      )}
                      {membership.activeSanctionsCount === 0 && membership.resolvedReportsReceivedCount === 0 && (
                        <span className={styles.tdSecondary}>Sin alertas en esta institución</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.modalFooter}>
              <Button onClick={() => setActiveUser(null)} variant="ghost">
                Cerrar
              </Button>
              {activeUser.accountStatus === AccountStatus.Suspended ? (
                <Button
                  disabled={isUpdatingUserId === activeUser.userId}
                  onClick={() => void handleAccountStatusChange(activeUser.userId, AccountStatus.Active)}
                >
                  {isUpdatingUserId === activeUser.userId ? 'Reactivando...' : 'Reactivar cuenta'}
                </Button>
              ) : (
                <Button
                  disabled={isUpdatingUserId === activeUser.userId}
                  onClick={() => void handleAccountStatusChange(activeUser.userId, AccountStatus.Suspended)}
                >
                  {isUpdatingUserId === activeUser.userId ? 'Bloqueando...' : 'Bloquear cuenta'}
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
