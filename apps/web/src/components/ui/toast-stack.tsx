'use client';

import { useEffect } from 'react';

export type ToastTone = 'success' | 'error' | 'info';

export type ToastItem = {
  id: string;
  title: string;
  description?: string;
  tone?: ToastTone;
};

type ToastStackProps = {
  toasts: ToastItem[];
  onDismiss: (toastId: string) => void;
  autoHideMs?: number;
};

export function ToastStack({
  toasts,
  onDismiss,
  autoHideMs = 4200,
}: ToastStackProps) {
  useEffect(() => {
    if (!toasts.length) {
      return;
    }

    const timers = toasts.map((toast) =>
      window.setTimeout(() => {
        onDismiss(toast.id);
      }, autoHideMs),
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [autoHideMs, onDismiss, toasts]);

  if (!toasts.length) {
    return null;
  }

  return (
    <div aria-live="polite" className="toast-stack" role="status">
      {toasts.map((toast) => (
        <article
          key={toast.id}
          className={[
            'toast-card',
            `toast-card-${toast.tone ?? 'info'}`,
          ].join(' ')}
        >
          <div className="toast-card-copy">
            <strong>{toast.title}</strong>
            {toast.description ? <p>{toast.description}</p> : null}
          </div>
          <button
            aria-label="Cerrar notificacion"
            className="toast-dismiss"
            onClick={() => onDismiss(toast.id)}
            type="button"
          >
            ×
          </button>
        </article>
      ))}
    </div>
  );
}
