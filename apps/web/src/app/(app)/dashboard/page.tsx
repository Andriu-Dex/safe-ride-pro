'use client';

import Link from 'next/link';
import {
  GlobalUserRole,
  InstitutionMembershipRole,
} from '@saferidepro/shared-types';
import { useEffect, useState } from 'react';

import { Button } from '../../../components/ui/button';
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
  const roleLabel = getGlobalRoleLabel(authSession?.user.globalRole ?? GlobalUserRole.User);
  const membershipRoleLabel = getMembershipRoleLabel(currentMembership?.role);
  const visibleTrustLabel = trustSummary
    ? getVisibleReputationStateLabel(trustSummary.visibleReputationState)
    : 'Pendiente';
  const administrativeRiskLabel = trustSummary
    ? getAdministrativeRiskStateLabel(trustSummary.administrativeRiskState)
    : 'Pendiente';
  const auditVisible = canAccessAudit(authSession?.user);
  const isSyncing = isLoading || isRefreshing;
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
    <section className="dash-shell">
      <section className="dash-command">
        <div className="dash-command-copy">
          <p className="section-label">Dashboard</p>
          <h1 className="dash-command-title">Control operativo</h1>
          <p className="dash-command-subtitle">
            Monitorea estado institucional, riesgo y restricciones desde una sola vista ejecutiva.
          </p>
          <div className="chip-row">
            <span className="topbar-badge">Vista analitica</span>
            <StatusPill
              label={operationalAccess.hasOperationalMembership ? 'Contexto operativo listo' : 'Contexto limitado'}
              tone={operationalAccess.hasOperationalMembership ? 'success' : 'warning'}
            />
            <StatusPill
              label={visibleTrustLabel}
              tone={trustSummary ? getVisibleReputationTone(trustSummary.visibleReputationState) : 'neutral'}
            />
          </div>
        </div>

        <div className="dash-command-actions">
          <Button
            disabled={isSyncing}
            onClick={() => void refreshDashboard(true)}
            variant="secondary"
          >
            {isRefreshing ? 'Actualizando...' : 'Sincronizar'}
          </Button>
          <StatusPill
            label={currentMembership
              ? getDriverStatusLabel(effectiveDriverStatus ?? currentMembership.driverVerificationStatus)
              : 'Sin membresia'}
            tone={currentMembership
              ? getDriverStatusTone(effectiveDriverStatus ?? currentMembership.driverVerificationStatus)
              : 'neutral'}
          />
          <StatusPill
            label={isSyncing ? 'Sincronizando' : 'Actualizado'}
            tone={isSyncing ? 'warning' : 'success'}
          />
        </div>
      </section>

      {errorMessage ? <div className="form-error">{errorMessage}</div> : null}

      <section className="dash-metric-grid">
        <article className="dash-metric-card">
          <span className="dash-metric-label">Institucion</span>
          <strong className="dash-metric-value">{currentMembership?.institutionName ?? 'Sin institucion'}</strong>
          <p className="dash-metric-note">{membershipRoleLabel}</p>
        </article>
        <article className="dash-metric-card">
          <span className="dash-metric-label">Confianza visible</span>
          <strong className="dash-metric-value">{visibleTrustLabel}</strong>
          <p className="dash-metric-note">Estado de reputacion actual</p>
        </article>
        <article className="dash-metric-card">
          <span className="dash-metric-label">Riesgo</span>
          <strong className="dash-metric-value">{administrativeRiskLabel}</strong>
          <p className="dash-metric-note">Lectura administrativa interna</p>
        </article>
        <article className="dash-metric-card">
          <span className="dash-metric-label">Restricciones</span>
          <strong className="dash-metric-value">{hasRestrictions ? restrictionTitle : 'Sin bloqueos'}</strong>
          <p className="dash-metric-note">{restrictions.message ?? 'Cuenta habilitada para operar.'}</p>
        </article>
      </section>

      <section className="dash-main-grid">
        <article className="dash-card dash-card-focus">
          <div className="dash-card-head">
            <div>
              <p className="section-label">Operacion</p>
              <h2 className="section-title">Estado operativo actual</h2>
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

          <div className="dash-detail-grid">
            <div className="dash-detail-item">
              <span>Rol global</span>
              <strong>{roleLabel}</strong>
            </div>
            <div className="dash-detail-item">
              <span>Membresia</span>
              <strong>{currentMembership?.membershipStatus ?? 'Sin membresia'}</strong>
            </div>
            <div className="dash-detail-item">
              <span>Licencia</span>
              <strong>
                {currentMembership
                  ? getDriverLicenseStatusLabel(currentMembership.licenseStatus)
                  : 'Sin informacion'}
              </strong>
            </div>
            <div className="dash-detail-item">
              <span>Bloqueos</span>
              <strong>{hasRestrictions ? restrictionTitle : 'Sin bloqueos'}</strong>
            </div>
          </div>

          {driverLicenseMessage ? <div className="dash-inline-alert">{driverLicenseMessage}</div> : null}
        </article>

        <article className="dash-card">
          <div className="dash-card-head">
            <div>
              <p className="section-label">Acciones</p>
              <h2 className="section-title">Navegacion rapida</h2>
            </div>
            <StatusPill label="Prioridades" tone="success" />
          </div>

          <div className="dash-link-grid">
            <Link className="dash-link-card" href="/viajes">
              <strong>Viajes</strong>
              <span>Operacion diaria de movilidad.</span>
            </Link>
            <Link className="dash-link-card" href="/conductor">
              <strong>Conductor</strong>
              <span>Estado de habilitacion y documentos.</span>
            </Link>
            <Link className="dash-link-card" href="/vehiculos">
              <strong>Vehiculos</strong>
              <span>Disponibilidad y consistencia de flota.</span>
            </Link>
            <Link className="dash-link-card" href="/confianza">
              <strong>Confianza</strong>
              <span>Reputacion, sanciones y apelaciones.</span>
            </Link>
            {auditVisible ? (
              <Link className="dash-link-card" href="/auditoria">
                <strong>Auditoria</strong>
                <span>Eventos y trazabilidad administrativa.</span>
              </Link>
            ) : null}
            <button
              className="dash-link-card dash-link-card-action"
              onClick={() => void refreshDashboard(true)}
              type="button"
            >
              <strong>{isRefreshing ? 'Actualizando...' : 'Actualizar panel'}</strong>
              <span>Refresca toda la lectura del dashboard.</span>
            </button>
          </div>
        </article>
      </section>

      <section className="dash-main-grid dash-main-grid-secondary">
        <article className="dash-card">
          <div className="dash-card-head">
            <div>
              <p className="section-label">Alertas</p>
              <h2 className="section-title">Atencion inmediata</h2>
            </div>
            <StatusPill
              label={hasRestrictions ? 'Revisar' : 'Estable'}
              tone={hasRestrictions ? 'warning' : 'neutral'}
            />
          </div>

          <div className="dash-alert-list">
            <div className="dash-alert-item">
              <strong>Contexto institucional</strong>
              <p>
                {currentMembership
                  ? `Operando en ${currentMembership.institutionName} como ${membershipRoleLabel.toLowerCase()}.`
                  : 'No hay membresia operativa activa para esta sesion.'}
              </p>
            </div>
            <div className="dash-alert-item">
              <strong>Restricciones</strong>
              <p>{restrictions.message ?? 'No se detectan bloqueos operativos activos.'}</p>
            </div>
            <div className="dash-alert-item">
              <strong>Confianza</strong>
              <p>
                {trustSummary
                  ? `Visible: ${visibleTrustLabel.toLowerCase()} · Riesgo: ${administrativeRiskLabel.toLowerCase()}.`
                  : 'Aun no hay resumen de confianza para mostrar.'}
              </p>
            </div>
          </div>
        </article>

        <article className="dash-card">
          <div className="dash-card-head">
            <div>
              <p className="section-label">Checklist</p>
              <h2 className="section-title">Revision sugerida</h2>
            </div>
            <StatusPill label="4 pasos" tone="neutral" />
          </div>

          <div className="dash-checklist">
            <div className="dash-check-item">
              <span className="dash-check-index">1</span>
              <div>
                <strong>Contexto</strong>
                <p>Valida membresia, rol y permisos vigentes.</p>
              </div>
            </div>
            <div className="dash-check-item">
              <span className="dash-check-index">2</span>
              <div>
                <strong>Operacion</strong>
                <p>Confirma licencia y restricciones activas.</p>
              </div>
            </div>
            <div className="dash-check-item">
              <span className="dash-check-index">3</span>
              <div>
                <strong>Confianza</strong>
                <p>Revisa reputacion y señales de riesgo.</p>
              </div>
            </div>
            <div className="dash-check-item">
              <span className="dash-check-index">4</span>
              <div>
                <strong>Escalar</strong>
                <p>Si es necesario, deriva a auditoria.</p>
              </div>
            </div>
          </div>
        </article>
      </section>
    </section>
  );
}
