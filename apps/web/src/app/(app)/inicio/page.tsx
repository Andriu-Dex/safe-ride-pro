'use client';

import Link from 'next/link';
import {
  GlobalUserRole,
  InstitutionMembershipRole,
} from '@saferidepro/shared-types';
import { useEffect, useState } from 'react';

import { StatusPill } from '../../../components/ui/status-pill';
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
  getTrustRestrictions,
  getVisibleReputationStateLabel,
  getVisibleReputationTone,
} from '../../../modules/users/lib/trust-labels';
import type { TrustSummary } from '../../../modules/users/types/trust-summary';

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

export default function HomePage() {
  const { authSession, isHydrated, refreshSession } = useAuth();
  const operationalAccess = getOperationalAccessState(authSession?.user.memberships);
  const currentMembership =
    operationalAccess.operationalMembership ?? operationalAccess.selectedMembership;
  const [trustSummary, setTrustSummary] = useState<TrustSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadHome = async (accessToken: string) => {
    if (!operationalAccess.hasOperationalMembership) {
      setTrustSummary(null);
      return;
    }

    const trustSummaryData = await getCurrentUserTrustSummary(accessToken);
    setTrustSummary(trustSummaryData);
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

  return (
    <section className="home-shell">
      <section className="home-hero">
        <div className="home-hero-main">
          <p className="section-label">Inicio</p>
          <h1 className="home-title">Hola, {displayName}.</h1>
          <p className="home-subtitle">Tu operacion de hoy en un vistazo.</p>

          <div className="chip-row">
            <span className="topbar-badge">SafeRidePro</span>
            <StatusPill
              label={operationalAccess.hasOperationalMembership ? 'Cuenta operativa' : 'Cuenta limitada'}
              tone={operationalAccess.hasOperationalMembership ? 'success' : 'warning'}
            />
            <StatusPill
              label={trustSummary ? getVisibleReputationStateLabel(trustSummary.visibleReputationState) : 'Sin resumen'}
              tone={trustSummary ? getVisibleReputationTone(trustSummary.visibleReputationState) : 'neutral'}
            />
          </div>

          <div className="home-cta-row">
            <Link className="home-cta home-cta-primary" href="/viajes">
              <strong>Ir a viajes</strong>
              <span>Publicar, solicitar y gestionar.</span>
            </Link>
            <Link className="home-cta" href="/dashboard">
              <strong>Dashboard</strong>
              <span>Lectura analitica de estado.</span>
            </Link>
            <Link className="home-cta" href="/confianza">
              <strong>Confianza</strong>
              <span>Reputacion y alertas activas.</span>
            </Link>
          </div>
        </div>

        <aside className="home-status-card">
          <div className="home-status-head">
            <div>
              <h2 className="section-title">Estado actual</h2>
            </div>
            <StatusPill
              label={currentMembership ? getDriverStatusLabel(effectiveDriverStatus ?? currentMembership.driverVerificationStatus) : 'Sin membresia'}
              tone={currentMembership
                ? getDriverStatusTone(effectiveDriverStatus ?? currentMembership.driverVerificationStatus)
                : 'neutral'}
            />
          </div>

          <div className="home-status-grid">
            <div className="home-status-item">
              <span>Institucion</span>
              <strong>{currentMembership?.institutionName ?? 'Sin contexto operativo'}</strong>
            </div>
            <div className="home-status-item">
              <span>Perfil</span>
              <strong>{getGlobalRoleLabel(authSession?.user.globalRole ?? GlobalUserRole.User)}</strong>
            </div>
            <div className="home-status-item">
              <span>Rol institucional</span>
              <strong>{getMembershipRoleLabel(currentMembership?.role)}</strong>
            </div>
            <div className="home-status-item">
              <span>Riesgo</span>
              <strong>
                {trustSummary
                  ? getAdministrativeRiskStateLabel(trustSummary.administrativeRiskState)
                  : 'Pendiente'}
              </strong>
            </div>
          </div>

          {errorMessage ? <div className="form-error">{errorMessage}</div> : null}
        </aside>
      </section>

      <section className="home-metric-grid">
        <article className="home-metric-card">
          <span className="home-metric-label">Institucion activa</span>
          <strong className="home-metric-value">
            {currentMembership?.institutionName ?? 'Sin institucion'}
          </strong>
          <p className="home-metric-note">
            {currentMembership
              ? `${getMembershipRoleLabel(currentMembership.role)} en contexto operativo.`
              : 'Necesitas membresia operativa para habilitar modulos.'}
          </p>
        </article>

        <article className="home-metric-card">
          <span className="home-metric-label">Confianza</span>
          <strong className="home-metric-value">
            {trustSummary
              ? getVisibleReputationStateLabel(trustSummary.visibleReputationState)
              : 'Pendiente'}
          </strong>
          <p className="home-metric-note">
            {trustSummary
              ? `Riesgo: ${getAdministrativeRiskStateLabel(trustSummary.administrativeRiskState)}.`
              : 'Aparecera cuando exista contexto operativo.'}
          </p>
        </article>

        <article className="home-metric-card">
          <span className="home-metric-label">Restricciones</span>
          <strong className="home-metric-value">
            {hasRestrictions ? restrictionTitle : 'Sin bloqueos'}
          </strong>
          <p className="home-metric-note">
            {restrictions.message ?? 'No hay restricciones activas por ahora.'}
          </p>
        </article>
      </section>

      <section className="home-main-grid">
        <article className="home-card home-card-priority">
          <div className="home-card-head">
            <div>
              <p className="section-label">Siguiente movimiento</p>
              <h2 className="section-title">Que deberias hacer ahora</h2>
            </div>
            <StatusPill label="3 pasos" tone="success" />
          </div>

          <div className="home-step-list">
            <Link className="home-step" href="/conductor">
              <strong>1. Valida tu estado de conductor</strong>
              <span>Revisa licencia, documentos y aprobacion.</span>
            </Link>
            <Link className="home-step" href="/vehiculos">
              <strong>2. Asegura tus vehiculos activos</strong>
              <span>Confirma unidades listas para operar.</span>
            </Link>
            <Link className="home-step" href="/viajes">
              <strong>3. Ejecuta en viajes</strong>
              <span>Publica, acepta solicitudes o busca cupos.</span>
            </Link>
          </div>
        </article>

        <article className="home-card">
          <div className="home-card-head">
            <div>
              <p className="section-label">Accesos rapidos</p>
              <h2 className="section-title">Rutas de uso frecuente</h2>
            </div>
            <StatusPill
              label={isLoading ? 'Sincronizando' : isRefreshing ? 'Actualizando' : 'Listo'}
              tone={isLoading || isRefreshing ? 'warning' : 'neutral'}
            />
          </div>

          <div className="home-link-grid">
            <Link className="home-link-card" href="/conductor">
              <strong>Conductor</strong>
              <span>Solicitud y estado operativo.</span>
            </Link>
            <Link className="home-link-card" href="/vehiculos">
              <strong>Vehiculos</strong>
              <span>Registro y disponibilidad.</span>
            </Link>
            <Link className="home-link-card" href="/viajes">
              <strong>Viajes</strong>
              <span>Publicacion y gestion.</span>
            </Link>
            <Link className="home-link-card" href="/confianza">
              <strong>Confianza</strong>
              <span>Reputacion y sanciones.</span>
            </Link>
            {auditVisible ? (
              <Link className="home-link-card" href="/auditoria">
                <strong>Auditoria</strong>
                <span>Trazabilidad y control.</span>
              </Link>
            ) : null}
            <button
              className="home-link-card home-link-card-action"
              onClick={() => void refreshHome(true)}
              type="button"
            >
              <strong>{isRefreshing ? 'Actualizando...' : 'Actualizar inicio'}</strong>
              <span>Sincroniza esta vista con tu estado actual.</span>
            </button>
          </div>
        </article>
      </section>

      {driverLicenseMessage ? (
        <section className="home-license-alert">
          <StatusPill
            label={getDriverLicenseStatusLabel(currentMembership?.licenseStatus)}
            tone={getDriverLicenseStatusTone(currentMembership?.licenseStatus)}
          />
          <p className="panel-text">{driverLicenseMessage}</p>
        </section>
      ) : null}
    </section>
  );
}
