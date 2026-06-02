import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  isOperationalMembership,
  selectOperationalMembership,
} from '@saferidepro/shared-types';

import { useAuth } from '../../../../modules/auth/hooks/use-auth';
import { getOperationalAccessState } from '../../../../modules/auth/lib/operational-context';
import { listMyRatings } from '../../../../modules/ratings/lib/rating-api';
import type { RatingList } from '../../../../modules/ratings/types/rating';
import { listMyReports } from '../../../../modules/reports/lib/report-api';
import type { ReportRecord } from '../../../../modules/reports/types/report';
import { listIncomingTripRequests, listMyTripRequests } from '../../../../modules/trip-requests/lib/trip-request-api';
import type { TripRequestRecord } from '../../../../modules/trip-requests/types/trip-request';
import { getCurrentUserTrustSummary } from '../../../../modules/users/lib/user-api';
import type { TrustSummary } from '../../../../modules/users/types/trust-summary';
import { listMySanctionAppeals } from '../../../../modules/sanctions/lib/sanction-api';
import type { OperationalSanctionAppealRecord } from '../../../../modules/sanctions/types/sanction';
import { getApiErrorMessage } from '../utils/trust-helpers';

export function useTrustData() {
  const { authSession, isHydrated, refreshSession } = useAuth();
  const searchParams = useSearchParams();
  
  const operationalAccess = getOperationalAccessState(authSession?.user.memberships);
  const defaultMembership = selectOperationalMembership(authSession?.user.memberships);
  const defaultMembershipId = defaultMembership && isOperationalMembership(defaultMembership) ? defaultMembership.id : undefined;

  const [trustSummary, setTrustSummary] = useState<TrustSummary | null>(null);
  const [ratings, setRatings] = useState<RatingList>({ given: [], received: [] });
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [sanctionAppeals, setSanctionAppeals] = useState<OperationalSanctionAppealRecord[]>([]);
  const [myRequests, setMyRequests] = useState<TripRequestRecord[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<TripRequestRecord[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshingData, setIsRefreshingData] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadData = async (accessToken: string) => {
    const [
      trustSummaryData,
      ratingsData,
      reportsData,
      appealsData,
      myTripRequests,
      incomingTripRequests,
    ] = await Promise.all([
      getCurrentUserTrustSummary(accessToken),
      listMyRatings(accessToken),
      listMyReports(accessToken),
      listMySanctionAppeals(accessToken),
      listMyTripRequests(accessToken),
      listIncomingTripRequests(accessToken),
    ]);

    setTrustSummary(trustSummaryData);
    setRatings(ratingsData);
    setReports(reportsData);
    setSanctionAppeals(appealsData);
    setMyRequests(myTripRequests);
    setIncomingRequests(incomingTripRequests);
  };

  const refreshData = async (showSpinner = false) => {
    if (!authSession) return;
    if (showSpinner) setIsRefreshingData(true);

    try {
      await loadData(authSession.accessToken);
    } catch (error: any) {
      if (error?.status === 403) {
        await refreshSession().catch(() => undefined);
      }
      setErrorMessage(getApiErrorMessage(error, 'No fue posible sincronizar calificaciones y reportes.'));
    } finally {
      if (showSpinner) setIsRefreshingData(false);
    }
  };

  useEffect(() => {
    if (!isHydrated) return;

    if (!authSession || !operationalAccess.hasOperationalMembership) {
      setTrustSummary(null);
      setRatings({ given: [], received: [] });
      setReports([]);
      setSanctionAppeals([]);
      setMyRequests([]);
      setIncomingRequests([]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const initialize = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        await loadData(authSession.accessToken);
      } catch (error: any) {
        if (!isMounted) return;
        if (error?.status === 403) {
          await refreshSession().catch(() => undefined);
        }
        setErrorMessage(getApiErrorMessage(error, 'No fue posible cargar calificaciones y reportes.'));
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void initialize();
    return () => { isMounted = false; };
  }, [authSession, isHydrated, operationalAccess.hasOperationalMembership]);

  return {
    authSession,
    isHydrated,
    operationalAccess,
    defaultMembershipId,
    trustSummary,
    ratings,
    reports,
    sanctionAppeals,
    myRequests,
    incomingRequests,
    isLoading,
    isRefreshingData,
    errorMessage,
    setErrorMessage,
    successMessage,
    setSuccessMessage,
    refreshData,
    refreshSession,
    searchParams,
    loadData
  };
}
