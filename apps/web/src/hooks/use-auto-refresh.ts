import { useEffect, useEffectEvent } from 'react';

type UseAutoRefreshOptions = {
  enabled: boolean;
  intervalMs?: number;
  refreshOnVisible?: boolean;
};

export function useAutoRefresh(
  onRefresh: () => Promise<void> | void,
  { enabled, intervalMs, refreshOnVisible = true }: UseAutoRefreshOptions,
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

    const intervalId =
      typeof intervalMs === 'number'
        ? window.setInterval(() => {
            void triggerRefresh();
          }, intervalMs)
        : null;

    const handleVisibilityChange = () => {
      if (refreshOnVisible && document.visibilityState === 'visible') {
        void triggerRefresh();
      }
    };

    if (refreshOnVisible) {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }

      if (refreshOnVisible) {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [enabled, intervalMs, refreshOnVisible, handleRefresh]);
}
