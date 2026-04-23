'use client';

import type { ToastItem } from './toast-stack';

const FLASH_TOASTS_STORAGE_KEY = 'saferidepro.ui.flash-toasts';

type PersistedToastInput = Omit<ToastItem, 'id'> & {
  id?: string;
};

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

export function persistToast(toast: PersistedToastInput) {
  if (!canUseStorage()) {
    return;
  }

  const nextToast: ToastItem = {
    id: toast.id ?? `flash-toast-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: toast.title,
    description: toast.description,
    tone: toast.tone,
  };

  const existingToasts = readPersistedToasts();
  window.sessionStorage.setItem(
    FLASH_TOASTS_STORAGE_KEY,
    JSON.stringify([...existingToasts, nextToast]),
  );
}

export function readPersistedToasts(): ToastItem[] {
  if (!canUseStorage()) {
    return [];
  }

  const rawValue = window.sessionStorage.getItem(FLASH_TOASTS_STORAGE_KEY);

  if (!rawValue) {
    return [];
  }

  try {
    const parsedValue = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      window.sessionStorage.removeItem(FLASH_TOASTS_STORAGE_KEY);
      return [];
    }

    return parsedValue.filter(
      (item): item is ToastItem =>
        typeof item === 'object' &&
        item !== null &&
        typeof item.id === 'string' &&
        typeof item.title === 'string',
    );
  } catch {
    window.sessionStorage.removeItem(FLASH_TOASTS_STORAGE_KEY);
    return [];
  }
}

export function consumePersistedToasts(): ToastItem[] {
  const toasts = readPersistedToasts();

  if (canUseStorage()) {
    window.sessionStorage.removeItem(FLASH_TOASTS_STORAGE_KEY);
  }

  return toasts;
}
