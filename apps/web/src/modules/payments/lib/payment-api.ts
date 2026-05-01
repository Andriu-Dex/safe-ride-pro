import { apiRequest } from '../../../lib/api-client';
import type { TripPaymentRecord } from '../types/payment';

type PaymentMutationResponse = {
  message: string;
  payment: TripPaymentRecord;
  checkoutUrl?: string;
};

export async function createPaymentCheckoutLink(
  accessToken: string,
  paymentId: string,
): Promise<PaymentMutationResponse> {
  return apiRequest<PaymentMutationResponse>(`/payments/${paymentId}/checkout-link`, {
    method: 'POST',
    accessToken,
    body: {},
  });
}

export async function refreshPaymentStatus(
  accessToken: string,
  paymentId: string,
): Promise<PaymentMutationResponse> {
  return apiRequest<PaymentMutationResponse>(`/payments/${paymentId}/refresh-status`, {
    method: 'POST',
    accessToken,
    body: {},
  });
}

export async function capturePayment(
  accessToken: string,
  paymentId: string,
): Promise<PaymentMutationResponse> {
  return apiRequest<PaymentMutationResponse>(`/payments/${paymentId}/capture`, {
    method: 'POST',
    accessToken,
    body: {},
  });
}
