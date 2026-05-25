export type WalletAccountRecord = {
  id: string;
  currencyCode: string;
  availableBalance: number;
  heldBalance: number;
  updatedAt: string;
};

export type WalletMovementRecord = {
  id: string;
  type: string;
  amount: number;
  availableBalanceAfter: number;
  heldBalanceAfter: number;
  note: string | null;
  createdAt: string;
};

export type WalletTopUpRecord = {
  id: string;
  provider: string;
  status: string;
  currencyCode: string;
  amount: number;
  checkoutUrl: string | null;
  paidAt: string | null;
  expiresAt: string | null;
  updatedAt: string;
  createdAt: string;
};

export type WalletRecord = {
  account: WalletAccountRecord;
  movements: WalletMovementRecord[];
  topUps: WalletTopUpRecord[];
};

export type WalletTopUpMutationResponse = {
  message: string;
  topUp: WalletTopUpRecord;
  wallet?: WalletRecord;
  checkoutUrl?: string;
};
