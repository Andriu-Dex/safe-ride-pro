'use client';

import Link from 'next/link';
import {
  GlobalUserRole,
  InstitutionMembershipRole,
} from '@saferidepro/shared-types';
import { useEffect, useState } from 'react';

import { Button } from '../../../components/ui/button';
import { InfoCard } from '../../../components/ui/info-card';
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
  getAdministrativeRiskTone,
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

export default function DashboardPage() {
  const { authSession, isHydrated, refreshSession } = useAuth();
  const operationalAccess = getOperationalAccessState(authSession?.user.memberships);
  const currentMembership =
    operationalAccess.operationalMembership ?? operationalAccess.selectedMembership;
  const [trustSummary, setTrustSummary] = useState<TrustSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadDashboard = async (accessToken: string) => {
    if (!operationalAccess.hasOperationalMembership) {
      setTrustSummary(null);
      return;
    }

    const trustSummaryData = await getCurrentUserTrustSummary(accessToken);
    setTrustSummary(trustSummaryData);
  };

  const refreshDashboard = async (showSpinner = false) => {
    if (!authSession) {
      return;
    }

    if (showSpinner) {
      setIsRefreshing(true);
    }

    try {
      await loadDashboard(authSession.accessToken);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setErrorMessage(
        getApiErrorMessage(error, 'No fue posible sincronizar el resumen del panel.'),
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
        await loadDashboard(authSession.accessToken);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        if (error instanceof ApiError && error.status === 403) {
          await refreshSession().catch(() => undefined);
        }

        setErrorMessage(
          getApiErrorMessage(error, 'No fue posible cargar el resumen del panel.'),
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
      await refreshDashboard();
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

  return (
    <>
      <header className="topbar">
        <div>
          <h1 className="topbar-title">Resumen operativo</h1>
          <p className="topbar-subtitle">
            Vista de control para validar el estado real de la cuenta, su contexto institucional y los flujos clave del MVP.
          </p>
        </div>
        <div className="topbar-actions">
          <span className="topbar-badge">Sesion protegida</span>
          <StatusPill
            label={operationalAccess.hasOperationalMembership ? 'Contexto operativo listo' : 'Contexto limitado'}
            tone={operationalAccess.hasOperationalMembership ? 'success' : 'warning'}
          />
          <StatusPill
            label={trustSummary ? getVisibleReputationStateLabel(trustSummary.visibleReputationState) : 'Sin resumen'}
            tone={trustSummary ? getVisibleReputationTone(trustSummary.visibleReputationState) : 'neutral'}
          />
        </div>
      </header>

      <section className="content-grid">
        <div className="metrics-grid">
          <InfoCard
            description={currentMembership
              ? `${getMembershipRoleLabel(currentMembership.role)} en ${currentMembership.institutionName}.`
              : 'Todavia no se detecta una membresia institucional para operar.'}
            label="Contexto institucional"
            value={currentMembership?.institutionName ?? 'Sin institucion operativa'}
          />
          <InfoCard
            description="El panel ya resuelve rol global y rol institucional para orientar las acciones de la demo."
            label="Rol actual"
            value={getGlobalRoleLabel(authSession?.user.globalRole ?? GlobalUserRole.User)}
          />
          <InfoCard
            description={trustSummary
              ? `Riesgo administrativo: ${getAdministrativeRiskStateLabel(trustSummary.administrativeRiskState)}.`
              : 'Cuando exista una membresia operativa se cargara el resumen de confianza.'}
            label="Confianza"
            value={trustSummary
              ? getVisibleReputationStateLabel(trustSummary.visibleReputationState)
              : 'Pendiente'}
          />
        </div>

        <div className="page-grid">
          <article className="panel panel-stack">
            <StatusPill label="Listo para demo" tone="success" />
            <h2 className="panel-title">Accesos rapidos</h2>
            <p className="panel-text">
              Desde aqui puedes saltar a los flujos que mas conviene mostrar a revisores: viajes, confianza y auditoria administrativa.
            </p>
            <div className="button-row">
              <Link className="button button-primary" href="/viajes">
                Abrir viajes
              </Link>
              <Link className="button button-secondary" href="/confianza">
                Revisar confianza
              </Link>
              <Link className="button button-secondary" href="/auditoria">
                Ir a auditoria
              </Link>
            </div>
          </article>

          <article className="panel panel-stack">
            <StatusPill
              label={currentMembership ? getDriverStatusLabel(effectiveDriverStatus ?? currentMembership.driverVerificationStatus) : 'Sin membresia'}
              tone={currentMembership
                ? getDriverStatusTone(effectiveDriverStatus ?? currentMembership.driverVerificationStatus)
                : 'neutral'}
            />
            <h2 className="panel-title">Estado operativo actual</h2>
            <div className="panel-meta-list">
              <p className="panel-meta-item">
                <strong>Membresia:</strong> {currentMembership?.membershipStatus ?? 'Sin membresia'}
              </p>
              <p className="panel-meta-item">
                <strong>Rol institucional:</strong> {getMembershipRoleLabel(currentMembership?.role)}
              </p>
              <p className="panel-meta-item">
                <strong>Licencia:</strong>{' '}
                {currentMembership ? (
                  <span className={`inline-tone inline-tone-${getDriverLicenseStatusTone(currentMembership.licenseStatus)}`}>
                    {getDriverLicenseStatusLabel(currentMembership.licenseStatus)}
                  </span>
                ) : (
                  'Sin informacion'
                )}
              </p>
              <p className="panel-meta-item">
                <strong>Bloqueos:</strong> {restrictions.message ?? 'Sin restricciones operativas activas'}
              </p>
              <p className="panel-meta-item">
                <strong>Riesgo administrativo:</strong>{' '}
                {trustSummary ? (
                  <span className={`inline-tone inline-tone-${getAdministrativeRiskTone(trustSummary.administrativeRiskState)}`}>
                    {getAdministrativeRiskStateLabel(trustSummary.administrativeRiskState)}
                  </span>
                ) : (
                  'Pendiente'
                )}
              </p>
            </div>
            {driverLicenseMessage ? <p className="panel-text">{driverLicenseMessage}</p> : null}
            {errorMessage ? <div className="form-error">{errorMessage}</div> : null}
          </article>

          <article className="panel panel-stack">
            <StatusPill label={isLoading ? 'Sincronizando' : isRefreshing ? 'Actualizando' : 'Checklist demo'} tone={isLoading || isRefreshing ? 'warning' : 'neutral'} />
            <h2 className="panel-title">Validacion final sugerida</h2>
            <div className="panel-meta-list">
              <p className="panel-meta-item"><strong>1.</strong> Inicia sesion y confirma el contexto institucional.</p>
              <p className="panel-meta-item"><strong>2.</strong> Crea o publica un viaje y verifica filtros o bloqueos.</p>
              <p className="panel-meta-item"><strong>3.</strong> Revisa confianza, sanciones o apelaciones si existen.</p>
              <p className="panel-meta-item"><strong>4.</strong> Entra a auditoria y valida eventos, reportes y revision administrativa.</p>
            </div>
            <div className="button-row">
              <Button disabled={isRefreshing || isLoading} onClick={() => void refreshDashboard(true)} variant="ghost">
                {isRefreshing ? 'Actualizando...' : 'Actualizar resumen'}
              </Button>
            </div>
          </article>
        </div>
      </section>
    </>
  );
}
