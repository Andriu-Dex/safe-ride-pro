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
      return 'Pendiente de verificacion';
    default:
      return status;
  }
}

function getAccountStatusTone(status: AccountStatus): 'success' | 'warning' | 'danger' | 'neutral' {
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

function formatDateTime(value: string | null): string {
  if (!value) {
    return 'No disponible';
  }

  return new Date(value).toLocaleString('es-EC');
}

export default function AdminUsersPage() {
  const { authSession, isHydrated, refreshSession } = useAuth();
  const [users, setUsers] = useState<AdminUserDirectoryRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [institutionId, setInstitutionId] = useState('');
  const [accountStatus, setAccountStatus] = useState('');
  const [driverStatus, setDriverStatus] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFiltering, setIsFiltering] = useState(false);
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
      limit: 40,
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

  const handleApplyFilters = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsFiltering(true);
    setTimeout(() => {
      setIsFiltering(false);
    }, 0);
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setInstitutionId('');
    setAccountStatus('');
    setDriverStatus('');
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

  const activeFiltersCount = [searchQuery, institutionId, accountStatus, driverStatus].filter(Boolean).length;

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
              Busca personas, revisa su contexto institucional y controla el acceso sin mezclarlo con la moderacion de incidentes.
            </p>
          </div>

          <div className={styles.heroActions}>
            <StatusPill
              label={users.length ? `${users.length} usuarios visibles` : 'Sin resultados'}
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

            <form className={styles.filterForm} onSubmit={handleApplyFilters}>
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
                <option value={AccountStatus.PendingEmailVerification}>Pendiente de verificacion</option>
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

              <div className={styles.filterActions}>
                <Button disabled={isFiltering} type="submit">
                  Aplicar filtros
                </Button>
                <Button disabled={isFiltering} onClick={handleResetFilters} type="button" variant="ghost">
                  Limpiar
                </Button>
              </div>
            </form>
          </aside>

          <div className={styles.content}>
            <section className={styles.sectionHeader}>
              <div>
                <p className={styles.sectionKicker}>Cuentas</p>
                <h2 className={styles.sectionTitle}>Usuarios dentro de tu alcance</h2>
                <p className={styles.sectionSubtitle}>
                  Revisa rol, estado de acceso, membresias y señales administrativas antes de tomar una accion.
                </p>
              </div>
            </section>

            {users.length ? (
              <div className={styles.userList}>
                {users.map((user) => (
                  <article className={styles.userCard} key={user.userId}>
                    <div className={styles.userHeader}>
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

                      <div className={styles.userStatus}>
                        <StatusPill
                          label={getAccountStatusLabel(user.accountStatus)}
                          tone={getAccountStatusTone(user.accountStatus)}
                        />
                        <StatusPill
                          label={user.emailVerifiedAt ? 'Correo verificado' : 'Correo pendiente'}
                          tone={user.emailVerifiedAt ? 'success' : 'warning'}
                        />
                      </div>
                    </div>

                    <div className={styles.userFacts}>
                      <div className={styles.factItem}>
                        <span>Registro</span>
                        <strong>{formatDateTime(user.createdAt)}</strong>
                      </div>
                      <div className={styles.factItem}>
                        <span>Ultima verificacion</span>
                        <strong>{formatDateTime(user.emailVerifiedAt)}</strong>
                      </div>
                      <div className={styles.factItem}>
                        <span>Membresias visibles</span>
                        <strong>{user.memberships.length}</strong>
                      </div>
                    </div>

                    <div className={styles.membershipList}>
                      {user.memberships.map((membership) => (
                        <div className={styles.membershipRow} key={membership.id}>
                          <div className={styles.membershipMain}>
                            <strong>{membership.institutionName}</strong>
                            <span>
                              {membership.role === InstitutionMembershipRole.InstitutionAdmin
                                ? 'Administrador institucional'
                                : 'Estudiante'}
                              {' · '}
                              {membership.studentCode}
                            </span>
                          </div>

                          <div className={styles.membershipSignals}>
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
                            <span>Sanciones activas: {membership.activeSanctionsCount}</span>
                            <span>Bloqueantes: {membership.activeBlockingSanctionsCount}</span>
                            <span>Reportes resueltos: {membership.resolvedReportsReceivedCount}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className={styles.userActions}>
                      {user.accountStatus === AccountStatus.Suspended ? (
                        <Button
                          disabled={isUpdatingUserId === user.userId}
                          onClick={() => void handleAccountStatusChange(user.userId, AccountStatus.Active)}
                        >
                          {isUpdatingUserId === user.userId ? 'Reactivando...' : 'Reactivar cuenta'}
                        </Button>
                      ) : (
                        <Button
                          disabled={isUpdatingUserId === user.userId}
                          onClick={() => void handleAccountStatusChange(user.userId, AccountStatus.Suspended)}
                          variant="ghost"
                        >
                          {isUpdatingUserId === user.userId ? 'Bloqueando...' : 'Bloquear cuenta'}
                        </Button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <section className={styles.emptyState}>
                <h2 className={styles.emptyTitle}>Sin resultados</h2>
                <p className={styles.emptyText}>
                  No hay usuarios que coincidan con los filtros actuales dentro de tu alcance administrativo.
                </p>
              </section>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
