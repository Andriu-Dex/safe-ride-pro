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
    <section className="analytics-stack">
      <section className="analytics-hero">
        <div className="analytics-hero-main">
          <p className="section-label">Dashboard</p>
          <h1 className="analytics-title">Panel de control para leer tu estado operativo.</h1>
          <p className="analytics-support">
            Esta vista esta pensada para monitoreo: concentra contexto institucional,
            reputacion, riesgo administrativo y acciones utiles para revisar el sistema
            con mas detalle.
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
        </div>

        <aside className="analytics-spotlight">
          <div className="section-card-header">
            <div>
              <p className="section-label">Lectura rapida</p>
              <h2 className="section-title">Instantanea del sistema</h2>
            </div>
            <StatusPill
              label={isSyncing ? 'Sincronizando' : 'Actualizado'}
              tone={isSyncing ? 'warning' : 'neutral'}
            />
          </div>

          <div className="snapshot-list">
            <div className="snapshot-item">
              <span>Institucion</span>
              <strong>{currentMembership?.institutionName ?? 'Sin contexto operativo'}</strong>
            </div>
            <div className="snapshot-item">
              <span>Rol actual</span>
              <strong>{roleLabel}</strong>
            </div>
            <div className="snapshot-item">
              <span>Perfil conductor</span>
              <strong>
                {currentMembership
                  ? getDriverStatusLabel(
                      effectiveDriverStatus ?? currentMembership.driverVerificationStatus,
                    )
                  : 'Sin membresia'}
              </strong>
            </div>
            <div className="snapshot-item">
              <span>Riesgo</span>
              <strong>{administrativeRiskLabel}</strong>
            </div>
          </div>

          {errorMessage ? <div className="form-error">{errorMessage}</div> : null}
        </aside>
      </section>

      <section className="analytics-metric-strip">
        <article className="analytics-metric">
          <span className="analytics-metric-label">Institucion activa</span>
          <strong className="analytics-metric-value">
            {currentMembership?.institutionName ?? 'Sin institucion'}
          </strong>
          <p className="analytics-metric-text">
            {currentMembership
              ? `${membershipRoleLabel} en contexto operativo.`
              : 'Necesitas una membresia activa para habilitar todos los modulos.'}
          </p>
        </article>

        <article className="analytics-metric">
          <span className="analytics-metric-label">Confianza visible</span>
          <strong className="analytics-metric-value">{visibleTrustLabel}</strong>
          <p className="analytics-metric-text">
            {trustSummary
              ? 'Estado mostrado al usuario segun reputacion, reportes y sanciones.'
              : 'Aparecera cuando exista un contexto operativo disponible.'}
          </p>
        </article>

        <article className="analytics-metric">
          <span className="analytics-metric-label">Riesgo administrativo</span>
          <strong className="analytics-metric-value">{administrativeRiskLabel}</strong>
          <p className="analytics-metric-text">
            {trustSummary
              ? 'Lectura interna para seguimiento y decisiones administrativas.'
              : 'Sin evaluacion disponible todavia.'}
          </p>
        </article>

        <article className="analytics-metric">
          <span className="analytics-metric-label">Restricciones</span>
          <strong className="analytics-metric-value">
            {hasRestrictions ? restrictionTitle : 'Sin bloqueos'}
          </strong>
          <p className="analytics-metric-text">
            {restrictions.message ?? 'No hay restricciones operativas activas en este momento.'}
          </p>
        </article>
      </section>

      <section className="analytics-grid">
        <article className="analytics-panel analytics-panel-focus">
          <div className="analytics-panel-head">
            <div>
              <p className="section-label">Operacion</p>
              <h2 className="section-title">Estado operativo actual</h2>
            </div>
            <StatusPill
              label={currentMembership
                ? getDriverStatusLabel(
                    effectiveDriverStatus ?? currentMembership.driverVerificationStatus,
                  )
                : 'Sin membresia'}
              tone={currentMembership
                ? getDriverStatusTone(
                    effectiveDriverStatus ?? currentMembership.driverVerificationStatus,
                  )
                : 'neutral'}
            />
          </div>

          <div className="analytics-detail-grid">
            <div className="analytics-detail-card">
              <span>Membresia</span>
              <strong>{currentMembership?.membershipStatus ?? 'Sin membresia'}</strong>
              <p>{membershipRoleLabel}</p>
            </div>
            <div className="analytics-detail-card">
              <span>Licencia</span>
              <strong>
                {currentMembership
                  ? getDriverLicenseStatusLabel(currentMembership.licenseStatus)
                  : 'Sin informacion'}
              </strong>
              <p>Se usa para decidir si puedes conducir y publicar viajes.</p>
            </div>
            <div className="analytics-detail-card">
              <span>Riesgo</span>
              <strong>{administrativeRiskLabel}</strong>
              <p>
                {trustSummary
                  ? 'Combinacion de reportes, reputacion y revision administrativa.'
                  : 'Sin resumen de riesgo disponible.'}
              </p>
            </div>
            <div className="analytics-detail-card">
              <span>Bloqueos</span>
              <strong>{hasRestrictions ? restrictionTitle : 'Sin bloqueos'}</strong>
              <p>{restrictions.message ?? 'Tu cuenta puede operar con normalidad.'}</p>
            </div>
          </div>

          {driverLicenseMessage ? (
            <div className="analytics-note">{driverLicenseMessage}</div>
          ) : null}

          <div className="button-row">
            <Button
              disabled={isSyncing}
              onClick={() => void refreshDashboard(true)}
              variant="ghost"
            >
              {isRefreshing ? 'Actualizando...' : 'Actualizar lectura'}
            </Button>
          </div>
        </article>

        <article className="analytics-panel">
          <div className="analytics-panel-head">
            <div>
              <p className="section-label">Acciones</p>
              <h2 className="section-title">Rutas recomendadas</h2>
            </div>
            <StatusPill label="Prioridades" tone="success" />
          </div>

          <div className="analytics-action-grid">
            <Link className="analytics-link-card" href="/conductor">
              <strong>Conductor</strong>
              <p>Revisa aprobacion, licencia y documentos antes de operar.</p>
            </Link>
            <Link className="analytics-link-card" href="/vehiculos">
              <strong>Vehiculos</strong>
              <p>Confirma disponibilidad y consistencia de los vehiculos registrados.</p>
            </Link>
            <Link className="analytics-link-card" href="/viajes">
              <strong>Viajes</strong>
              <p>Publica, gestiona solicitudes y valida cambios de estado.</p>
            </Link>
            <Link className="analytics-link-card" href="/confianza">
              <strong>Confianza</strong>
              <p>Consulta reputacion, sanciones activas y apelaciones.</p>
            </Link>
            <Link className="analytics-link-card" href="/auditoria">
              <strong>Auditoria</strong>
              <p>Monitorea eventos, reportes y revisiones administrativas.</p>
            </Link>
            <button
              className="analytics-link-card analytics-link-card-action"
              onClick={() => void refreshDashboard(true)}
              type="button"
            >
              <strong>{isRefreshing ? 'Actualizando...' : 'Sincronizar panel'}</strong>
              <p>Recarga este dashboard con el estado mas reciente de la cuenta.</p>
            </button>
          </div>
        </article>
      </section>

      <section className="analytics-grid analytics-grid-secondary">
        <article className="analytics-panel">
          <div className="analytics-panel-head">
            <div>
              <p className="section-label">Alertas</p>
              <h2 className="section-title">Atencion inmediata</h2>
            </div>
            <StatusPill
              label={hasRestrictions ? 'Revisar' : 'Estable'}
              tone={hasRestrictions ? 'warning' : 'neutral'}
            />
          </div>

          <div className="analytics-list">
            <div className="analytics-list-item">
              <strong>Contexto institucional</strong>
              <p>
                {currentMembership
                  ? `Estas operando en ${currentMembership.institutionName} como ${membershipRoleLabel.toLowerCase()}.`
                  : 'No existe una membresia operativa activa para esta sesion.'}
              </p>
            </div>
            <div className="analytics-list-item">
              <strong>Restricciones</strong>
              <p>{restrictions.message ?? 'No se detectan bloqueos operativos activos.'}</p>
            </div>
            <div className="analytics-list-item">
              <strong>Confianza y reputacion</strong>
              <p>
                {trustSummary
                  ? `La cuenta se muestra como ${visibleTrustLabel.toLowerCase()} y el riesgo actual es ${administrativeRiskLabel.toLowerCase()}.`
                  : 'Aun no hay resumen de confianza para mostrar.'}
              </p>
            </div>
          </div>
        </article>

        <article className="analytics-panel">
          <div className="analytics-panel-head">
            <div>
              <p className="section-label">Control</p>
              <h2 className="section-title">Checklist sugerido</h2>
            </div>
            <StatusPill label="Revision" tone="neutral" />
          </div>

          <div className="analytics-checklist">
            <div className="analytics-check-item">
              <span className="analytics-check-index">1</span>
              <div>
                <strong>Confirma el contexto</strong>
                <p>Valida membresia, rol institucional y permisos reales de la sesion.</p>
              </div>
            </div>
            <div className="analytics-check-item">
              <span className="analytics-check-index">2</span>
              <div>
                <strong>Verifica la operacion</strong>
                <p>Comprueba licencia, restricciones y disponibilidad para conducir o solicitar.</p>
              </div>
            </div>
            <div className="analytics-check-item">
              <span className="analytics-check-index">3</span>
              <div>
                <strong>Revisa confianza</strong>
                <p>Consulta reputacion, sanciones vigentes y estado de apelaciones.</p>
              </div>
            </div>
            <div className="analytics-check-item">
              <span className="analytics-check-index">4</span>
              <div>
                <strong>Entra a auditoria si hace falta</strong>
                <p>Usa el modulo administrativo para revisar eventos o reportes delicados.</p>
              </div>
            </div>
          </div>
        </article>
      </section>
    </section>
  );
}
