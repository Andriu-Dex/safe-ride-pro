'use client';

import Link from 'next/link';
import {
  GlobalUserRole,
  InstitutionMembershipRole,
} from '@saferidepro/shared-types';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '../../../components/ui/button';
import { StatusPill } from '../../../components/ui/status-pill';
import { ToastItem, ToastStack } from '../../../components/ui/toast-stack';
import { useAutoRefresh } from '../../../hooks/use-auto-refresh';
import { ApiError } from '../../../lib/api-client';
import { canAccessAudit } from '../../../modules/audit/lib/audit-access';
import { useAuth } from '../../../modules/auth/hooks/use-auth';
import { getOperationalAccessState } from '../../../modules/auth/lib/operational-context';
import {
  getDriverLicenseAlertMessage,
  getDriverLicenseStatusLabel,
  getDriverLicenseStatusTone,
  getDriverStatusLabel,
  getDriverStatusTone,
} from '../../../modules/driver/lib/driver-status';
import { getCurrentUserTrustSummary } from '../../../modules/users/lib/user-api';
import {
  getAdministrativeRiskStateLabel,
  getAdministrativeRiskTone,
  getTrustRestrictions,
  getVisibleReputationStateLabel,
  getVisibleReputationTone,
} from '../../../modules/users/lib/trust-labels';
import type { TrustSummary } from '../../../modules/users/types/trust-summary';
import styles from './page.module.css';

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

function getMembershipRoleLabel(role?: InstitutionMembershipRole): string {
  switch (role) {
    case InstitutionMembershipRole.InstitutionAdmin:
      return 'Administrador institucional';
    case InstitutionMembershipRole.Student:
      return 'Estudiante';
    default:
      return 'Sin rol institucional';
  }
}

function getApiErrorMessage(error: unknown, fallbackMessage: string): string {
  return error instanceof ApiError ? error.message : fallbackMessage;
}

function getPreferredDisplayName(fullName?: string): string {
  if (!fullName) {
    return 'usuario';
  }

  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

function getOperationalHeadline(
  hasOperationalMembership: boolean,
  driverLicenseMessage: string | null,
  hasRestrictions: boolean,
) {
  if (!hasOperationalMembership) {
    return {
      title: 'Completa tu contexto operativo',
      description: 'Completa tu perfil para habilitar tus opciones de movilidad.',
      actionHref: '/perfil',
      actionLabel: 'Ir a perfil',
    };
  }

  if (driverLicenseMessage) {
    return {
      title: 'Revisa tu habilitacion antes de salir',
      description: driverLicenseMessage,
      actionHref: '/conductor',
      actionLabel: 'Revisar conductor',
    };
  }

  if (hasRestrictions) {
    return {
      title: 'Tu cuenta necesita atencion operativa',
      description: 'Hay observaciones o restricciones activas. Revísalas antes de ejecutar viajes o aceptar nuevas solicitudes.',
      actionHref: '/confianza',
      actionLabel: 'Abrir confianza',
    };
  }

  return {
    title: 'Tu operacion de hoy esta lista',
    description: 'Continua con viajes, conductor o vehiculos.',
    actionHref: '/viajes',
    actionLabel: 'Abrir viajes',
  };
}

export default function HomePage() {
  const { authSession, isHydrated, refreshSession } = useAuth();
  const operationalAccess = getOperationalAccessState(authSession?.user.memberships);
  const currentMembership =
    operationalAccess.operationalMembership ?? operationalAccess.selectedMembership;
  const [trustSummary, setTrustSummary] = useState<TrustSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const loadHome = async (accessToken: string) => {
    if (!operationalAccess.hasOperationalMembership) {
      setTrustSummary(null);
      return;
    }

    const trustSummaryData = await getCurrentUserTrustSummary(accessToken);
    setTrustSummary(trustSummaryData);
  };

  const pushToast = (title: string, description: string, tone: ToastItem['tone'] = 'info') => {
    setToasts((currentToasts) => [
      ...currentToasts,
      {
        id: `home-toast-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title,
        description,
        tone,
      },
    ]);
  };

  const dismissToast = (toastId: string) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== toastId));
  };

  const refreshHome = async (showSpinner = false) => {
    if (!authSession) {
      return;
    }

    if (showSpinner) {
      setIsRefreshing(true);
    }

    try {
      await loadHome(authSession.accessToken);

      if (showSpinner) {
        pushToast(
          'Inicio actualizado',
          'Tu informacion fue actualizada.',
          'success',
        );
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setErrorMessage(
        getApiErrorMessage(error, 'No fue posible sincronizar la pantalla de inicio.'),
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

    let isMounted = true;

    const initialize = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        await loadHome(authSession.accessToken);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof ApiError && error.status === 403) {
          await refreshSession().catch(() => undefined);
        }

        setErrorMessage(
          getApiErrorMessage(error, 'No fue posible cargar la pantalla de inicio.'),
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
  }, [authSession, isHydrated, operationalAccess.hasOperationalMembership, refreshSession]);

  useAutoRefresh(
    async () => {
      await refreshHome();
    },
    {
      enabled: Boolean(authSession),
      intervalMs: 30000,
    },
  );

  const restrictions = getTrustRestrictions(trustSummary);
  const effectiveDriverStatus =
    currentMembership?.effectiveDriverVerificationStatus ?? currentMembership?.driverVerificationStatus;
  const driverLicenseMessage = getDriverLicenseAlertMessage(
    currentMembership?.licenseStatus,
    currentMembership?.licenseExpiresInDays,
  );
  const displayName = getPreferredDisplayName(authSession?.user.fullName);
  const auditVisible = canAccessAudit(authSession?.user);
  const hasRestrictions =
    restrictions.blocksPassenger ||
    restrictions.blocksDriver ||
    Boolean(restrictions.message);
  const restrictionTitle = restrictions.blocksPassenger && restrictions.blocksDriver
    ? 'Movilidad limitada'
    : restrictions.blocksDriver
      ? 'Operacion de conductor limitada'
      : restrictions.blocksPassenger
        ? 'Operacion de pasajero limitada'
        : restrictions.message
          ? 'Observacion activa'
          : 'Sin bloqueos';

  const operationalHeadline = getOperationalHeadline(
    operationalAccess.hasOperationalMembership,
    driverLicenseMessage,
    hasRestrictions,
  );

  const opsMetrics = useMemo(
    () => [
      {
        label: 'Contexto activo',
        value: currentMembership?.institutionName ?? 'Sin contexto',
        note: currentMembership
          ? `${getMembershipRoleLabel(currentMembership.role)} en sesion.`
          : 'Completa tu perfil para habilitar opciones.',
      },
      {
        label: 'Conductor',
        value: currentMembership
          ? getDriverStatusLabel(effectiveDriverStatus ?? currentMembership.driverVerificationStatus)
          : 'Pendiente',
        note: currentMembership
          ? 'Estado de habilitacion para ejecutar viajes.'
          : 'Aun no tienes contexto operativo.',
      },
      {
        label: 'Confianza visible',
        value: trustSummary
          ? getVisibleReputationStateLabel(trustSummary.visibleReputationState)
          : 'Pendiente',
        note: trustSummary
          ? `${trustSummary.completedInteractions} interacciones completadas.`
          : 'Se mostrara cuando exista historial.',
      },
      {
        label: 'Foco de hoy',
        value: hasRestrictions ? restrictionTitle : 'Operacion estable',
        note: restrictions.message ?? 'No se detectan restricciones activas por ahora.',
      },
    ],
    [
      currentMembership,
      effectiveDriverStatus,
      hasRestrictions,
      restrictionTitle,
      restrictions.message,
      trustSummary,
    ],
  );

  return (
    <>
      <ToastStack onDismiss={dismissToast} toasts={toasts} />

      <section className={styles.homeShell}>
        <section className={`${styles.hero} ${styles.reveal}`}>
          <div className={styles.heroTop}>
            <div className={styles.heroCopy}>
              <p className={styles.eyebrow}>Inicio operativo</p>
              <h1 className={styles.heroTitle}>Hola, {displayName}.</h1>
            </div>

            <div className={styles.heroPills}>
              <StatusPill
                label={operationalAccess.hasOperationalMembership ? 'Cuenta operativa' : 'Cuenta limitada'}
                tone={operationalAccess.hasOperationalMembership ? 'success' : 'warning'}
              />
              <StatusPill
                label={trustSummary ? getVisibleReputationStateLabel(trustSummary.visibleReputationState) : 'Sin resumen'}
                tone={trustSummary ? getVisibleReputationTone(trustSummary.visibleReputationState) : 'neutral'}
              />
              <StatusPill
                label={isLoading ? 'Sincronizando' : isRefreshing ? 'Actualizando' : 'Listo'}
                tone={isLoading || isRefreshing ? 'warning' : 'neutral'}
              />
            </div>
          </div>

          <div className={styles.opsStrip}>
            {opsMetrics.map((metric) => (
              <article className={styles.opsCard} key={metric.label}>
                <span className={styles.opsLabel}>{metric.label}</span>
                <strong className={styles.opsValue}>{metric.value}</strong>
                <span className={styles.opsNote}>{metric.note}</span>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.mainGrid}>
          <div className={styles.leftRail}>
            <article className={`${styles.focusCard} ${styles.reveal}`}>
              <div className={styles.cardHeader}>
                <div>
                  <p className={styles.eyebrow}>Siguiente movimiento</p>
                  <h2>Prioridad actual</h2>
                </div>
                <StatusPill label="Acceso directo" tone="success" />
              </div>

              <div className={styles.focusPanel}>
                <div className={styles.focusPrimary}>
                  <h3>{operationalHeadline.title}</h3>
                  <p>{operationalHeadline.description}</p>
                  <div className={styles.focusActions}>
                    <Link className="button button-primary" href={operationalHeadline.actionHref}>
                      {operationalHeadline.actionLabel}
                    </Link>
                    <Link className="button button-secondary" href="/dashboard">
                      Abrir dashboard
                    </Link>
                  </div>
                </div>

                <div className={styles.focusSecondary}>
                  <article className={styles.signalCard}>
                    <span>Rol global</span>
                    <strong>{getGlobalRoleLabel(authSession?.user.globalRole ?? GlobalUserRole.User)}</strong>
                  </article>
                  <article className={styles.signalCard}>
                    <span>Licencia</span>
                    <strong>{getDriverLicenseStatusLabel(currentMembership?.licenseStatus)}</strong>
                  </article>
                  <article className={styles.signalCard}>
                    <span>Riesgo</span>
                    <strong>
                      {trustSummary
                        ? getAdministrativeRiskStateLabel(trustSummary.administrativeRiskState)
                        : 'Pendiente'}
                    </strong>
                  </article>
                </div>
              </div>
            </article>

            <article className={`${styles.statusCard} ${styles.reveal}`}>
              <div className={styles.cardHeader}>
                <div>
                  <p className={styles.eyebrow}>Estado base</p>
                  <h2>Lectura rapida de la cuenta</h2>
                </div>
                <StatusPill
                  label={currentMembership
                    ? getDriverStatusLabel(effectiveDriverStatus ?? currentMembership.driverVerificationStatus)
                    : 'Sin membresia'}
                  tone={currentMembership
                    ? getDriverStatusTone(effectiveDriverStatus ?? currentMembership.driverVerificationStatus)
                    : 'neutral'}
                />
              </div>

              <div className={styles.statusGrid}>
                <article className={styles.statusItem}>
                  <span>Institucion</span>
                  <strong>{currentMembership?.institutionName ?? 'Sin contexto operativo'}</strong>
                </article>
                <article className={styles.statusItem}>
                  <span>Rol institucional</span>
                  <strong>{getMembershipRoleLabel(currentMembership?.role)}</strong>
                </article>
                <article className={styles.statusItem}>
                  <span>Correo</span>
                  <strong>{authSession?.user.email}</strong>
                </article>
                <article className={styles.statusItem}>
                  <span>Licencia</span>
                  <strong>{getDriverLicenseStatusLabel(currentMembership?.licenseStatus)}</strong>
                </article>
              </div>

              {errorMessage ? <div className="form-error">{errorMessage}</div> : null}
            </article>

            <article className={`${styles.workspaceCard} ${styles.reveal}`}>
              <div className={styles.cardHeader}>
                <div>
                  <p className={styles.eyebrow}>Ejecucion diaria</p>
                  <h2>Espacios de trabajo</h2>
                </div>
                <StatusPill label="Acciones" tone="neutral" />
              </div>

              <div className={styles.workspaceGrid}>
                <Link className={styles.workspaceLink} href="/viajes">
                  <strong>Viajes</strong>
                  <span>Publica, explora cupos y gestiona salidas del dia.</span>
                </Link>
                <Link className={styles.workspaceLink} href="/conductor">
                  <strong>Conductor</strong>
                  <span>Revisa aprobacion, licencia y capacidad de operacion.</span>
                </Link>
                <Link className={styles.workspaceLink} href="/vehiculos">
                  <strong>Vehiculos</strong>
                  <span>Activa flota, consistencia documental y disponibilidad.</span>
                </Link>
                <Link className={styles.workspaceLink} href="/confianza">
                  <strong>Confianza</strong>
                  <span>Observa reputacion, sanciones y cierres pendientes.</span>
                </Link>
              </div>
            </article>
          </div>

          <aside className={styles.rightRail}>
            <article className={`${styles.timelineCard} ${styles.reveal}`}>
              <div className={styles.cardHeader}>
                <div>
                  <p className={styles.eyebrow}>Ruta sugerida</p>
                  <h2>Orden recomendado</h2>
                </div>
                <StatusPill label="3 pasos" tone="success" />
              </div>

              <div className={styles.timelineList}>
                <article className={styles.timelineItem}>
                  <span className={styles.timelineIndex}>1</span>
                  <div className={styles.timelineBody}>
                    <strong>Valida tu estado</strong>
                    <p>Revisa tu contexto, licencia y estado actual.</p>
                  </div>
                </article>
                <article className={styles.timelineItem}>
                  <span className={styles.timelineIndex}>2</span>
                  <div className={styles.timelineBody}>
                    <strong>Prepara tu ejecucion</strong>
                    <p>Verifica conductor y vehiculos antes de continuar.</p>
                  </div>
                </article>
                <article className={styles.timelineItem}>
                  <span className={styles.timelineIndex}>3</span>
                  <div className={styles.timelineBody}>
                    <strong>Entra en operacion</strong>
                    <p>Gestiona solicitudes y trayectos del dia desde Viajes.</p>
                  </div>
                </article>
              </div>
            </article>

            <article className={`${styles.trustCard} ${styles.reveal}`}>
              <div className={styles.cardHeader}>
                <div>
                  <p className={styles.eyebrow}>Confianza y limites</p>
                  <h2>Condicion operativa</h2>
                </div>
                <StatusPill
                  label={trustSummary
                    ? getAdministrativeRiskStateLabel(trustSummary.administrativeRiskState)
                    : 'Pendiente'}
                  tone={trustSummary ? getAdministrativeRiskTone(trustSummary.administrativeRiskState) : 'neutral'}
                />
              </div>

              <div className={styles.restrictionsBox}>
                <div
                  className={[
                    styles.restrictionBanner,
                    hasRestrictions ? styles.restrictionBannerDanger : styles.restrictionBannerNeutral,
                  ].join(' ')}
                >
                  <strong>{hasRestrictions ? restrictionTitle : 'Operacion estable'}</strong>
                  <span>{restrictions.message ?? 'No hay restricciones activas.'}</span>
                </div>

                <div className={styles.restrictionMetrics}>
                  <article className={styles.restrictionMetric}>
                    <span>Interacciones</span>
                    <strong>{trustSummary ? trustSummary.completedInteractions : '0'}</strong>
                  </article>
                  <article className={styles.restrictionMetric}>
                    <span>Reportes resueltos</span>
                    <strong>{trustSummary ? trustSummary.resolvedReportsReceived : '0'}</strong>
                  </article>
                  <article className={styles.restrictionMetric}>
                    <span>Sanciones recientes</span>
                    <strong>{trustSummary ? trustSummary.recentSanctionCount : '0'}</strong>
                  </article>
                  <article className={styles.restrictionMetric}>
                    <span>Bloqueos activos</span>
                    <strong>{trustSummary ? trustSummary.recentBlockingSanctionCount : '0'}</strong>
                  </article>
                </div>
              </div>
            </article>

            <article className={`${styles.quickCard} ${styles.reveal}`}>
              <div className={styles.cardHeader}>
                <div>
                  <p className={styles.eyebrow}>Soporte rapido</p>
                  <h2>Acciones auxiliares</h2>
                </div>
                <StatusPill label="Utilidades" tone="neutral" />
              </div>

              <div className={styles.quickActions}>
                {auditVisible ? (
                  <Link className="button button-secondary" href="/auditoria">
                    Abrir auditoria
                  </Link>
                ) : null}
                <Link className="button button-secondary" href="/perfil">
                  Editar perfil
                </Link>
                <Button
                  className={styles.refreshButton}
                  disabled={isRefreshing}
                  onClick={() => void refreshHome(true)}
                  variant="ghost"
                >
                  {isRefreshing ? 'Actualizando inicio...' : 'Actualizar inicio'}
                </Button>
              </div>
            </article>
          </aside>
        </section>
      </section>
    </>
  );
}
