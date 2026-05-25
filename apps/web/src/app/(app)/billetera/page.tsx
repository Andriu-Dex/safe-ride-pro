'use client';

import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '../../../components/ui/button';
import { InputField } from '../../../components/ui/input-field';
import { StatusPill } from '../../../components/ui/status-pill';
import { ToastStack, type ToastItem } from '../../../components/ui/toast-stack';
import { ApiError } from '../../../lib/api-client';
import { useAuth } from '../../../modules/auth/hooks/use-auth';
import {
  captureWalletTopUp,
  createWalletTopUp,
  getWallet,
  refreshWalletTopUpStatus,
} from '../../../modules/wallet/lib/wallet-api';
import {
  formatWalletAmount,
  getWalletMovementLabel,
  getWalletTopUpStatusLabel,
} from '../../../modules/wallet/lib/wallet-labels';
import type { WalletRecord } from '../../../modules/wallet/types/wallet';
import styles from './page.module.css';

function getApiErrorMessage(error: unknown, fallbackMessage: string): string {
  return error instanceof ApiError ? error.message : fallbackMessage;
}

export default function WalletPage() {
  const searchParams = useSearchParams();
  const { authSession, isHydrated, refreshSession } = useAuth();
  const processedReturnRef = useRef<string | null>(null);

  const [wallet, setWallet] = useState<WalletRecord | null>(null);
  const [amount, setAmount] = useState('10');
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = useCallback((title: string, description: string, tone: ToastItem['tone']) => {
    setToasts((currentToasts) => [
      ...currentToasts,
      {
        id: `wallet-toast-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title,
        description,
        tone,
      },
    ]);
  }, []);

  const dismissToast = useCallback((toastId: string) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== toastId));
  }, []);

  const loadWallet = useCallback(async () => {
    if (!authSession) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      setWallet(await getWallet(authSession.accessToken));
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setErrorMessage(getApiErrorMessage(error, 'No fue posible cargar la billetera.'));
    } finally {
      setIsLoading(false);
    }
  }, [authSession, refreshSession]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    void loadWallet();
  }, [isHydrated, loadWallet]);

  useEffect(() => {
    if (!errorMessage) {
      return;
    }

    pushToast('No fue posible continuar', errorMessage, 'error');
    setErrorMessage(null);
  }, [errorMessage, pushToast]);

  useEffect(() => {
    if (!authSession) {
      return;
    }

    const topUpId = searchParams.get('topUpId');
    const topUpResult = searchParams.get('topUpResult');

    if (!topUpId || processedReturnRef.current === topUpId) {
      return;
    }

    processedReturnRef.current = topUpId;

    if (topUpResult === 'cancel') {
      pushToast('Recarga cancelada', 'PayPal no confirmo el pago.', 'info');
      return;
    }

    const captureReturn = async () => {
      setIsMutating(true);

      try {
        const response = await captureWalletTopUp(authSession.accessToken, topUpId);
        setWallet(response.wallet ?? (await getWallet(authSession.accessToken)));
        pushToast('Recarga acreditada', response.message, 'success');
      } catch (error) {
        setErrorMessage(getApiErrorMessage(error, 'No fue posible confirmar la recarga.'));
      } finally {
        setIsMutating(false);
      }
    };

    void captureReturn();
  }, [authSession, pushToast, searchParams]);

  const handleCreateTopUp = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!authSession) {
      return;
    }

    const parsedAmount = Number.parseFloat(amount);

    if (!Number.isFinite(parsedAmount) || parsedAmount < 1) {
      setErrorMessage('Ingresa un monto valido.');
      return;
    }

    setIsMutating(true);
    setErrorMessage(null);

    try {
      const response = await createWalletTopUp(authSession.accessToken, parsedAmount);

      if (response.checkoutUrl) {
        const paypalWindow = window.open(response.checkoutUrl, '_blank', 'noopener,noreferrer');

        if (!paypalWindow) {
          setErrorMessage('El navegador bloqueo la ventana de PayPal.');
        }
      }

      await loadWallet();
      pushToast('Recarga creada', response.message, 'success');
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        await refreshSession().catch(() => undefined);
      }

      setErrorMessage(getApiErrorMessage(error, 'No fue posible crear la recarga.'));
    } finally {
      setIsMutating(false);
    }
  };

  const handleRefreshTopUp = async (topUpId: string) => {
    if (!authSession) {
      return;
    }

    setIsMutating(true);

    try {
      const response = await refreshWalletTopUpStatus(authSession.accessToken, topUpId);
      setWallet(response.wallet ?? (await getWallet(authSession.accessToken)));
      pushToast('Recarga actualizada', response.message, 'success');
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'No fue posible actualizar la recarga.'));
    } finally {
      setIsMutating(false);
    }
  };

  if (isLoading) {
    return (
      <section className={styles.page}>
        <ToastStack onDismiss={dismissToast} toasts={toasts} />
        <article className={styles.stateCard}>
          <div aria-hidden="true" className={styles.loadingPulse} />
          <h1>Cargando billetera</h1>
        </article>
      </section>
    );
  }

  if (!authSession || !wallet) {
    return (
      <section className={styles.page}>
        <ToastStack onDismiss={dismissToast} toasts={toasts} />
        <article className={styles.stateCard}>
          <h1>Billetera no disponible</h1>
        </article>
      </section>
    );
  }

  return (
    <section className={styles.page}>
      <ToastStack onDismiss={dismissToast} toasts={toasts} />

      <header className={styles.hero}>
        <div>
          <p className={styles.kicker}>Billetera</p>
          <h1 className={styles.title}>Saldo SafeRidePro</h1>
        </div>
        <Button disabled={isMutating} onClick={() => void loadWallet()} variant="secondary">
          Actualizar
        </Button>
      </header>

      <div className={styles.layout}>
        <section className={styles.balancePanel}>
          <div className={styles.balanceMain}>
            <span>Disponible</span>
            <strong>{formatWalletAmount(wallet.account.availableBalance, wallet.account.currencyCode)}</strong>
          </div>
          <div className={styles.balanceMeta}>
            <span>Retenido</span>
            <strong>{formatWalletAmount(wallet.account.heldBalance, wallet.account.currencyCode)}</strong>
          </div>
        </section>

        <form className={styles.topUpPanel} onSubmit={handleCreateTopUp}>
          <div>
            <p className={styles.kicker}>Recarga</p>
            <h2>PayPal</h2>
          </div>
          <InputField
            label="Monto"
            min="1"
            onChange={(event) => setAmount(event.target.value)}
            step="0.01"
            type="number"
            value={amount}
          />
          <Button disabled={isMutating} type="submit">
            {isMutating ? 'Procesando...' : 'Recargar'}
          </Button>
        </form>
      </div>

      <section className={styles.tablePanel}>
        <div className={styles.sectionHead}>
          <h2>Movimientos</h2>
          <span>{wallet.movements.length}</span>
        </div>
        {wallet.movements.length ? (
          <div className={styles.table}>
            {wallet.movements.map((movement) => (
              <article className={styles.row} key={movement.id}>
                <div>
                  <strong>{getWalletMovementLabel(movement.type)}</strong>
                  <span>{formatDateTime(movement.createdAt)}</span>
                </div>
                <strong>{formatWalletAmount(movement.amount, wallet.account.currencyCode)}</strong>
              </article>
            ))}
          </div>
        ) : (
          <p className={styles.emptyText}>Sin movimientos.</p>
        )}
      </section>

      <section className={styles.tablePanel}>
        <div className={styles.sectionHead}>
          <h2>Recargas</h2>
          <span>{wallet.topUps.length}</span>
        </div>
        {wallet.topUps.length ? (
          <div className={styles.table}>
            {wallet.topUps.map((topUp) => (
              <article className={styles.row} key={topUp.id}>
                <div>
                  <strong>{formatWalletAmount(topUp.amount, topUp.currencyCode)}</strong>
                  <span>{formatDateTime(topUp.createdAt)}</span>
                </div>
                <div className={styles.rowActions}>
                  <StatusPill
                    label={getWalletTopUpStatusLabel(topUp.status)}
                    tone={topUp.status === 'PAID' ? 'success' : topUp.status === 'FAILED' ? 'danger' : 'neutral'}
                  />
                  {topUp.status !== 'PAID' ? (
                    <Button
                      disabled={isMutating}
                      onClick={() => void handleRefreshTopUp(topUp.id)}
                      type="button"
                      variant="secondary"
                    >
                      Verificar
                    </Button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className={styles.emptyText}>Sin recargas.</p>
        )}
      </section>
    </section>
  );
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('es-EC', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}
