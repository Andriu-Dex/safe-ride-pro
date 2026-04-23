'use client';

import { useEffect, useState } from 'react';

import { consumePersistedToasts } from './flash-toast';
import { ToastItem, ToastStack } from './toast-stack';

export function FlashToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    setToasts(consumePersistedToasts());
  }, []);

  const dismissToast = (toastId: string) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== toastId));
  };

  return <ToastStack onDismiss={dismissToast} toasts={toasts} />;
}
