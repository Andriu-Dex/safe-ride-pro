import { useEffect, useEffectEvent } from 'react';

type UseAutoRefreshOptions = {
  enabled: boolean;
  intervalMs: number;
};

export function useAutoRefresh(
  onRefresh: () => Promise<void> | void,
  { enabled, intervalMs }: UseAutoRefreshOptions,
) {
  const handleRefresh = useEffectEvent(async () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }

    await onRefresh();
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let isRefreshing = false;

    const triggerRefresh = async () => {
      if (isRefreshing) {
        return;
      }

      isRefreshing = true;

      try {
        await handleRefresh();
      } finally {
        isRefreshing = false;
      }
    };

    const intervalId = window.setInterval(() => {
      void triggerRefresh();
    }, intervalMs);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void triggerRefresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [enabled, intervalMs, handleRefresh]);
}
