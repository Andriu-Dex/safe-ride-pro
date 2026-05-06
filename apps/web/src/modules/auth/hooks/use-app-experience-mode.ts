'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  canAccessDriverTools,
  hasStartedDriverFlow,
} from '../lib/app-access';
import type { AuthUser } from '../types/auth-session';

export type AppExperienceMode = 'passenger' | 'driver';

const EXPERIENCE_MODE_STORAGE_KEY = 'saferidepro.ui.experience-mode';
const EXPERIENCE_MODE_EVENT = 'saferidepro:experience-mode-changed';

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readStoredExperienceMode(): AppExperienceMode | null {
  if (!canUseStorage()) {
    return null;
  }

  const value = window.localStorage.getItem(EXPERIENCE_MODE_STORAGE_KEY);

  return value === 'driver' || value === 'passenger' ? value : null;
}

export function setStoredExperienceMode(mode: AppExperienceMode) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(EXPERIENCE_MODE_STORAGE_KEY, mode);
  window.dispatchEvent(new CustomEvent<AppExperienceMode>(EXPERIENCE_MODE_EVENT, {
    detail: mode,
  }));
}

function resolveExperienceMode(
  user: Pick<AuthUser, 'memberships'> | null | undefined,
  requestedMode: AppExperienceMode | null | undefined,
): AppExperienceMode {
  if (!hasStartedDriverFlow(user)) {
    return 'passenger';
  }

  return requestedMode === 'driver' ? 'driver' : 'passenger';
}

export function useAppExperienceMode(
  user?: Pick<AuthUser, 'memberships'> | null,
) {
  const canUseDriverMode = hasStartedDriverFlow(user);
  const hasApprovedDriverMode = canAccessDriverTools(user);

  const [experienceMode, setExperienceModeState] = useState<AppExperienceMode>(() =>
    resolveExperienceMode(user ?? null, readStoredExperienceMode()),
  );

  useEffect(() => {
    setExperienceModeState((currentMode) => resolveExperienceMode(user ?? null, currentMode));
  }, [user, canUseDriverMode]);

  useEffect(() => {
    if (!canUseStorage()) {
      return;
    }

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== EXPERIENCE_MODE_STORAGE_KEY) {
        return;
      }

      setExperienceModeState(resolveExperienceMode(user ?? null, readStoredExperienceMode()));
    };

    const handleCustomEvent = (event: Event) => {
      const nextMode =
        event instanceof CustomEvent && (event.detail === 'driver' || event.detail === 'passenger')
          ? event.detail
          : readStoredExperienceMode();

      setExperienceModeState(resolveExperienceMode(user ?? null, nextMode));
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(EXPERIENCE_MODE_EVENT, handleCustomEvent);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(EXPERIENCE_MODE_EVENT, handleCustomEvent);
    };
  }, [user]);

  const setExperienceMode = useCallback((nextMode: AppExperienceMode) => {
    const resolvedMode = resolveExperienceMode(user ?? null, nextMode);
    setExperienceModeState(resolvedMode);
    setStoredExperienceMode(resolvedMode);
  }, [user]);

  const isDriverExperienceActive = useMemo(
    () => canUseDriverMode && experienceMode === 'driver',
    [canUseDriverMode, experienceMode],
  );

  return {
    experienceMode,
    setExperienceMode,
    canUseDriverMode,
    hasApprovedDriverMode,
    isDriverExperienceActive,
  };
}
