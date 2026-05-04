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
  return error instanceof ApiError ? error.message : fallbackMessage;
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
  name: 'detail' | 'lock' | 'unlock';
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
    case 'detail':
      return (
        <svg {...iconProps}>
          <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z" />
          <circle cx="12" cy="12" r="2" />
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
  const [fetchLimit, setFetchLimit] = useState('80');
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
    setFetchLimit('80');
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
    fetchLimit !== '80' ? fetchLimit : '',
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
          <article className={styles.loadingCard}>
            <div aria-hidden="true" className={styles.loadingPulse} />
            <h1 className={styles.loadingTitle}>Cargando usuarios</h1>
            <p className={styles.loadingText}>
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
        <section className={styles.pageShell}>
          <section className={styles.hero}>
            <div className={styles.heroCopy}>
              <p className={styles.kicker}>Usuarios</p>
              <h1 className={styles.heroTitle}>Gestion de cuentas</h1>
              <p className={styles.heroLead}>
                Esta vista solo esta disponible para administradores institucionales y superadministracion.
              </p>
            </div>
            <StatusPill label="Acceso restringido" tone="warning" />
          </section>
        </section>
      </>
    );
  }

  return (
    <>
      <ToastStack onDismiss={dismissToast} toasts={toasts} />

      <section className={styles.pageShell}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>Usuarios</p>
            <h1 className={styles.heroTitle}>Gestion de cuentas</h1>
            <p className={styles.heroLead}>
              Busca personas, revisa su contexto institucional y controla el acceso sin desperdiciar espacio en pantalla.
            </p>
          </div>

          <div className={styles.heroActions}>
            <StatusPill
              label={users.length ? `${users.length} visibles` : 'Sin resultados'}
              tone={users.length ? 'neutral' : 'warning'}
            />
            <Button
              disabled={isRefreshing}
              onClick={() => void refreshUsers(true)}
              variant="secondary"
            >
              {isRefreshing ? 'Actualizando...' : 'Actualizar'}
            </Button>
          </div>
        </section>

        <div className={styles.layout}>
          <aside className={styles.sidebar}>
            <div className={styles.sidebarHeader}>
              <div>
                <p className={styles.sidebarKicker}>Filtros</p>
                <h2 className={styles.sidebarTitle}>Directorio</h2>
              </div>
              {activeFiltersCount ? (
                <span className={styles.filterBadge}>{activeFiltersCount} activos</span>
              ) : null}
            </div>

            <div className={styles.filterForm}>
              <InputField
                label="Buscar"
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Nombre, correo o documento"
                value={searchQuery}
              />

              <SelectField
                label="Institucion"
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
                <option value="40">40 registros</option>
                <option value="80">80 registros</option>
                <option value="120">120 registros</option>
              </SelectField>

              <div className={styles.filterActions}>
                <Button onClick={() => setPage(1)}>Aplicar filtros</Button>
                <Button onClick={handleResetFilters} type="button" variant="ghost">
                  Limpiar
                </Button>
              </div>
            </div>
          </aside>

          <section className={styles.content}>
            <header className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionKicker}>Directorio</p>
                <h2 className={styles.sectionTitle}>Usuarios dentro de tu alcance</h2>
              </div>
              <StatusPill
                label={users.length ? `${users.length} registros` : 'Sin resultados'}
                tone={users.length ? 'neutral' : 'warning'}
              />
            </header>

            {users.length ? (
              <>
                <div className={styles.directoryTable}>
                  <div className={styles.tableHead}>
                    <span>Usuario</span>
                    <span>Institucion</span>
                    <span>Estado</span>
                    <span>Señales</span>
                    <span className={styles.actionsHeader}>Acciones</span>
                  </div>

                  <div className={styles.tableBody}>
                    {paginatedUsers.map((user) => {
                      const blockingSanctions = sumMembershipMetric(user, 'activeBlockingSanctionsCount');
                      const resolvedReports = sumMembershipMetric(user, 'resolvedReportsReceivedCount');

                      return (
                        <article className={styles.tableRow} key={user.userId}>
                          <div className={styles.userIdentity}>
                            <div className={styles.avatar}>
                              {user.profilePhotoUrl ? (
                                <img alt="" className={styles.avatarImage} src={user.profilePhotoUrl} />
                              ) : (
                                <span>{user.fullName.slice(0, 1).toUpperCase()}</span>
                              )}
                            </div>

                            <div className={styles.userMeta}>
                              <strong>{user.fullName}</strong>
                      <span>{user.email}</span>
                      <small>{getGlobalRoleLabel(user.globalRole)}</small>
                            </div>
                          </div>

                          <div className={styles.compactField}>
                            <strong>{getPrimaryInstitutionLabel(user)}</strong>
                            <span>{user.memberships.length} membresias</span>
                          </div>

                          <div className={styles.statusGroup}>
                            <StatusPill
                              label={getAccountStatusLabel(user.accountStatus)}
                              tone={getAccountStatusTone(user.accountStatus)}
                            />
                            <StatusPill
                              label={user.emailVerifiedAt ? 'Verificado' : 'Pendiente'}
                              tone={user.emailVerifiedAt ? 'success' : 'warning'}
                            />
                          </div>

                          <div className={styles.signalGroup}>
                            <span>{blockingSanctions} bloqueos</span>
                            <span>{resolvedReports} reportes</span>
                          </div>

                          <div className={styles.iconActions}>
                            <button
                              className={styles.iconButton}
                              onClick={() => setActiveUser(user)}
                              title="Ver detalle"
                              type="button"
                            >
                              <UserActionIcon className={styles.icon} name="detail" />
                            </button>

                            {user.accountStatus === AccountStatus.Suspended ? (
                              <button
                                className={styles.iconButton}
                                disabled={isUpdatingUserId === user.userId}
                                onClick={() => void handleAccountStatusChange(user.userId, AccountStatus.Active)}
                                title="Reactivar cuenta"
                                type="button"
                              >
                                <UserActionIcon className={styles.icon} name="unlock" />
                              </button>
                            ) : (
                              <button
                                className={`${styles.iconButton} ${styles.iconButtonDanger}`}
                                disabled={isUpdatingUserId === user.userId}
                                onClick={() => void handleAccountStatusChange(user.userId, AccountStatus.Suspended)}
                                title="Bloquear cuenta"
                                type="button"
                              >
                                <UserActionIcon className={styles.icon} name="lock" />
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>

                {users.length > PAGE_SIZE ? (
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
                        {currentPage}/{totalPages}
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
                ) : null}
              </>
            ) : (
              <section className={styles.emptyState}>
                <h2 className={styles.emptyTitle}>Sin resultados</h2>
                <p className={styles.emptyText}>
                  No hay usuarios que coincidan con los filtros actuales dentro de tu alcance administrativo.
                </p>
              </section>
            )}
          </section>
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
              <div>
                <p className={styles.modalKicker}>Usuario</p>
                <h2 className={styles.modalTitle} id="admin-user-detail-title">
                  {activeUser.fullName}
                </h2>
              </div>
              <button
                aria-label="Cerrar detalle"
                className={styles.modalClose}
                onClick={() => setActiveUser(null)}
                type="button"
              >
                X
              </button>
            </div>

            <div className={styles.modalFacts}>
              <div className={styles.modalFact}>
                <span>Correo</span>
                <strong>{activeUser.email}</strong>
              </div>
              <div className={styles.modalFact}>
                <span>Rol global</span>
                <strong>{getGlobalRoleLabel(activeUser.globalRole)}</strong>
              </div>
              <div className={styles.modalFact}>
                <span>Cuenta</span>
                <strong>{getAccountStatusLabel(activeUser.accountStatus)}</strong>
              </div>
              <div className={styles.modalFact}>
                <span>Registro</span>
                <strong>{formatDateTime(activeUser.createdAt)}</strong>
              </div>
            </div>

            <div className={styles.modalSection}>
              <h3 className={styles.modalSectionTitle}>Membresias</h3>
              <div className={styles.modalMembershipList}>
                {activeUser.memberships.map((membership) => (
                  <div className={styles.modalMembershipRow} key={membership.id}>
                    <div className={styles.modalMembershipMain}>
                      <strong>{membership.institutionName}</strong>
                      <span>
                        {getMembershipRoleLabel(membership.role)} | {membership.studentCode}
                      </span>
                    </div>

                    <div className={styles.modalMembershipSignals}>
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

                    <div className={styles.modalMembershipMetrics}>
                      <span>Sanciones: {membership.activeSanctionsCount}</span>
                      <span>Bloqueantes: {membership.activeBlockingSanctionsCount}</span>
                      <span>Reportes: {membership.resolvedReportsReceivedCount}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.modalActions}>
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
                  variant="ghost"
                >
                  {isUpdatingUserId === activeUser.userId ? 'Bloqueando...' : 'Bloquear cuenta'}
                </Button>
              )}
              <Button onClick={() => setActiveUser(null)} variant="secondary">
                Cerrar
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
