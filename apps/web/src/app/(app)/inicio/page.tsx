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
    <section className="experience-stack">
      <section className="experience-hero">
        <div className="experience-hero-main">
          <p className="section-label">Inicio</p>
          <h1 className="experience-title">Hola, {displayName}. Este es tu punto de partida.</h1>
          <p className="experience-support">
            Usa esta vista para orientarte rapido, entender el estado actual de tu cuenta
            y decidir si te conviene ir a viajes, confianza o al panel analitico.
          </p>

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

          <div className="button-row">
            <Link className="button button-primary" href="/viajes">
              Explorar viajes
            </Link>
            <Link className="button button-secondary" href="/dashboard">
              Abrir dashboard
            </Link>
            <Link className="button button-secondary" href="/confianza">
              Revisar confianza
            </Link>
          </div>
        </div>

        <aside className="experience-side-card">
          <div className="section-card-header">
            <div>
              <p className="section-label">Estado de hoy</p>
              <h2 className="section-title">Tu cuenta en este momento</h2>
            </div>
            <StatusPill
              label={currentMembership ? getDriverStatusLabel(effectiveDriverStatus ?? currentMembership.driverVerificationStatus) : 'Sin membresia'}
              tone={currentMembership
                ? getDriverStatusTone(effectiveDriverStatus ?? currentMembership.driverVerificationStatus)
                : 'neutral'}
            />
          </div>

          <div className="snapshot-list">
            <div className="snapshot-item">
              <span>Institucion</span>
              <strong>{currentMembership?.institutionName ?? 'Sin contexto operativo'}</strong>
            </div>
            <div className="snapshot-item">
              <span>Perfil actual</span>
              <strong>{getGlobalRoleLabel(authSession?.user.globalRole ?? GlobalUserRole.User)}</strong>
            </div>
            <div className="snapshot-item">
              <span>Rol institucional</span>
              <strong>{getMembershipRoleLabel(currentMembership?.role)}</strong>
            </div>
            <div className="snapshot-item">
              <span>Riesgo administrativo</span>
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

      <section className="summary-grid">
        <article className="summary-tile">
          <span className="summary-label">Institucion activa</span>
          <strong className="summary-value">
            {currentMembership?.institutionName ?? 'Sin institucion'}
          </strong>
          <p className="summary-text">
            {currentMembership
              ? `${getMembershipRoleLabel(currentMembership.role)} en contexto operativo.`
              : 'Necesitas una membresia operativa para usar todos los modulos.'}
          </p>
        </article>

        <article className="summary-tile">
          <span className="summary-label">Confianza</span>
          <strong className="summary-value">
            {trustSummary
              ? getVisibleReputationStateLabel(trustSummary.visibleReputationState)
              : 'Pendiente'}
          </strong>
          <p className="summary-text">
            {trustSummary
              ? `Riesgo: ${getAdministrativeRiskStateLabel(trustSummary.administrativeRiskState)}.`
              : 'El resumen aparecera cuando la cuenta opere con una institucion activa.'}
          </p>
        </article>

        <article className="summary-tile">
          <span className="summary-label">Restricciones</span>
          <strong className="summary-value">
            {hasRestrictions ? restrictionTitle : 'Sin bloqueos'}
          </strong>
          <p className="summary-text">
            {restrictions.message ?? 'No hay restricciones operativas activas en este momento.'}
          </p>
        </article>
      </section>

      <section className="section-grid-two">
        <article className="section-card section-card-highlight">
          <div className="section-card-header">
            <div>
              <p className="section-label">Siguiente paso</p>
              <h2 className="section-title">Que te conviene hacer ahora</h2>
            </div>
            <StatusPill label="Orientacion" tone="success" />
          </div>

          <div className="guided-list">
            <div className="guided-item">
              <strong>1. Revisa tu estado operativo</strong>
              <p>
                Confirma si tu cuenta, tu institucion y tu perfil de conductor estan listos para operar.
              </p>
            </div>
            <div className="guided-item">
              <strong>2. Decide tu objetivo principal</strong>
              <p>
                Si vas a viajar, entra a Viajes. Si vas a conducir, pasa por Conductor y Vehiculos.
              </p>
            </div>
            <div className="guided-item">
              <strong>3. Usa Dashboard para analisis</strong>
              <p>
                El dashboard queda como una vista mas analitica para monitoreo, no como tu pantalla de bienvenida.
              </p>
            </div>
          </div>
        </article>

        <article className="section-card">
          <div className="section-card-header">
            <div>
              <p className="section-label">Accesos rapidos</p>
              <h2 className="section-title">Rutas utiles</h2>
            </div>
            <StatusPill
              label={isLoading ? 'Sincronizando' : isRefreshing ? 'Actualizando' : 'Listo'}
              tone={isLoading || isRefreshing ? 'warning' : 'neutral'}
            />
          </div>

          <div className="quick-link-grid">
            <Link className="quick-link-card" href="/conductor">
              <strong>Conductor</strong>
              <p>Gestiona tu solicitud, estado y documentos para conducir.</p>
            </Link>
            <Link className="quick-link-card" href="/vehiculos">
              <strong>Vehiculos</strong>
              <p>Registra y revisa los vehiculos disponibles para operar.</p>
            </Link>
            <Link className="quick-link-card" href="/viajes">
              <strong>Viajes</strong>
              <p>Busca, publica o administra tus viajes desde un solo lugar.</p>
            </Link>
            <Link className="quick-link-card" href="/confianza">
              <strong>Confianza</strong>
              <p>Consulta sanciones, reputacion y estado de apelaciones.</p>
            </Link>
            <Link className="quick-link-card" href="/auditoria">
              <strong>Auditoria</strong>
              <p>Accede a revision administrativa y trazabilidad del sistema.</p>
            </Link>
            <button
              className="quick-link-card quick-link-card-action"
              onClick={() => void refreshHome(true)}
              type="button"
            >
              <strong>{isRefreshing ? 'Actualizando...' : 'Actualizar inicio'}</strong>
              <p>Sincroniza esta vista con el estado mas reciente de tu cuenta.</p>
            </button>
          </div>
        </article>
      </section>

      {driverLicenseMessage ? (
        <section className="section-card compact-banner">
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
