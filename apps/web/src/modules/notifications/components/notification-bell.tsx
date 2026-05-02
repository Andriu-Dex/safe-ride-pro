'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  REALTIME_NOTIFICATION_CREATED_EVENT,
  type RealtimeEvent,
} from '@saferidepro/shared-types';

import { persistToast } from '../../../components/ui/flash-toast';
import { useRealtimeEventStream } from '../../realtime/hooks/use-realtime-event-stream';
import {
  getUnreadNotificationCount,
  listNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from '../lib/notification-api';
import type { NotificationRecord } from '../types/notification';
import styles from './notification-bell.module.css';

type NotificationBellProps = {
  accessToken?: string;
};

export function NotificationBell({ accessToken }: NotificationBellProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isAvailable, setIsAvailable] = useState(true);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    const loadNotifications = async () => {
      try {
        const [notifications, count] = await Promise.all([
          listNotifications(accessToken),
          getUnreadNotificationCount(accessToken),
        ]);

        setItems(notifications);
        setUnreadCount(count);
        setIsAvailable(true);
      } catch {
        setIsAvailable(false);
        setItems([]);
        setUnreadCount(0);
      }
    };

    void loadNotifications();
  }, [accessToken]);

  useRealtimeEventStream({
    accessToken,
    enabled: Boolean(accessToken) && isAvailable,
    onEvent: (event: RealtimeEvent) => {
      if (event.type !== REALTIME_NOTIFICATION_CREATED_EVENT) {
        return;
      }

      setItems((currentItems) => [event.notification, ...currentItems].slice(0, 40));
      setUnreadCount((currentCount) => currentCount + 1);
    },
  });

  const handleOpenItem = async (notification: NotificationRecord) => {
    if (!accessToken) {
      return;
    }

    if (!notification.readAt) {
      await markNotificationAsRead(accessToken, notification.id);
      setItems((currentItems) =>
        currentItems.map((item) =>
          item.id === notification.id
            ? { ...item, readAt: new Date().toISOString() }
            : item,
        ),
      );
      setUnreadCount((currentCount) => Math.max(0, currentCount - 1));
    }

    setIsOpen(false);

    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }
  };

  const handleMarkAll = async () => {
    if (!accessToken) {
      return;
    }

    await markAllNotificationsAsRead(accessToken);
    const readAt = new Date().toISOString();
    setItems((currentItems) => currentItems.map((item) => ({ ...item, readAt })));
    setUnreadCount(0);
  };

  if (!isAvailable) {
    return (
      <div className={styles.bellWrap}>
        <button
          aria-label="Notificaciones no disponibles"
          className={styles.bellButton}
          onClick={() =>
            persistToast({
              title: 'Notificaciones no disponibles',
              description: 'Aplica la migracion pendiente para activar la campana.',
              tone: 'info',
            })}
          type="button"
        >
          <svg aria-hidden="true" className={styles.bellIcon} viewBox="0 0 24 24">
            <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
            <path d="M10 21h4" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className={styles.bellWrap}>
      <button
        aria-expanded={isOpen}
        aria-label="Abrir notificaciones"
        className={styles.bellButton}
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        type="button"
      >
        <svg aria-hidden="true" className={styles.bellIcon} viewBox="0 0 24 24">
          <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 7h18s-3 0-3-7" />
          <path d="M10 21h4" />
        </svg>
        {unreadCount > 0 ? (
          <span className={styles.badge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
        ) : null}
      </button>

      {isOpen ? (
        <section className={styles.panel}>
          <div className={styles.header}>
            <strong>Notificaciones</strong>
            <button onClick={handleMarkAll} type="button">
              Marcar leidas
            </button>
          </div>

          {items.length ? (
            <div className={styles.list}>
              {items.map((item) => (
                <button
                  key={item.id}
                  className={[styles.item, item.readAt ? '' : styles.itemUnread]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => void handleOpenItem(item)}
                  type="button"
                >
                  <strong>{item.title}</strong>
                  {item.body ? <p>{item.body}</p> : null}
                  <time>{new Date(item.createdAt).toLocaleString('es-EC')}</time>
                </button>
              ))}
            </div>
          ) : (
            <p className={styles.empty}>No tienes notificaciones pendientes.</p>
          )}
        </section>
      ) : null}
    </div>
  );
}
