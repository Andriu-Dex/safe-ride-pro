import { apiRequest } from '../../../lib/api-client';
import type { WalletRecord, WalletTopUpMutationResponse } from '../types/wallet';

export async function getWallet(accessToken: string): Promise<WalletRecord> {
  return apiRequest<WalletRecord>('/wallet', {
    accessToken,
  });
}

export async function createWalletTopUp(
  accessToken: string,
  amount: number,
): Promise<WalletTopUpMutationResponse> {
  return apiRequest<WalletTopUpMutationResponse>('/wallet/top-ups', {
    method: 'POST',
    accessToken,
    body: { amount },
  });
}

export async function captureWalletTopUp(
  accessToken: string,
  topUpId: string,
): Promise<WalletTopUpMutationResponse> {
  return apiRequest<WalletTopUpMutationResponse>(`/wallet/top-ups/${topUpId}/capture`, {
    method: 'POST',
    accessToken,
    body: {},
  });
}

export async function refreshWalletTopUpStatus(
  accessToken: string,
  topUpId: string,
): Promise<WalletTopUpMutationResponse> {
  return apiRequest<WalletTopUpMutationResponse>(`/wallet/top-ups/${topUpId}/refresh-status`, {
    method: 'POST',
    accessToken,
    body: {},
  });
}
