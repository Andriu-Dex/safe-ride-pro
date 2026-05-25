import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { PaymentProvider } from '@saferidepro/shared-types';

import { getAppEnvironment } from '../../../../shared/infrastructure/config/app-environment';
import type {
  CapturePaymentInput,
  CapturePaymentResult,
  CreatePaymentCheckoutInput,
  CreatePaymentCheckoutResult,
  FetchPaymentStatusInput,
  FetchPaymentStatusResult,
  PaymentProviderPort,
  RefundPaymentInput,
  RefundPaymentResult,
} from '../../application/ports/payment-provider';

type PaypalAccessTokenResponse = {
  access_token: string;
};

@Injectable()
export class PaypalPaymentProvider implements PaymentProviderPort {
  readonly name = PaymentProvider.Paypal;

  private readonly environment = getAppEnvironment();

  isConfigured(): boolean {
    return (
      this.environment.paypalEnabled
      && Boolean(this.environment.paypalClientId)
      && Boolean(this.environment.paypalClientSecret)
    );
  }

  async createCheckout(input: CreatePaymentCheckoutInput): Promise<CreatePaymentCheckoutResult> {
    const redirectUrls = this.buildRedirectUrls(input);
    const response = await this.request('/v2/checkout/orders', {
      method: 'POST',
      body: {
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: input.paymentId,
            custom_id: input.paymentId,
            invoice_id: input.merchantOrderReference,
            description:
              input.description ??
              `Cupo de viaje ${input.tripOriginLabel} - ${input.tripDestinationLabel}`,
            amount: {
              currency_code: input.currencyCode,
              value: input.amount.toFixed(2),
            },
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              payment_method_preference: 'IMMEDIATE_PAYMENT_REQUIRED',
              user_action: 'PAY_NOW',
              brand_name: this.environment.paypalBrandName,
              return_url: redirectUrls.success,
              cancel_url: redirectUrls.cancel,
            },
          },
        },
      },
    });

    const checkoutUrl =
      findFirstLink(response, ['approve', 'payer-action', 'payment-approve']);

    if (!checkoutUrl) {
      throw new InternalServerErrorException(
        'PayPal no devolvio un enlace de aprobacion utilizable.',
      );
    }

    return {
      provider: this.name,
      checkoutUrl,
      providerOrderToken: readString(response, ['id']),
      providerPaymentLinkId: readString(response, ['id']),
      providerOrderStatus: readString(response, ['status']),
      providerPaymentStatus: readString(response, ['purchase_units', '0', 'payments', 'captures', '0', 'status']),
      expiresAt: null,
      rawResponse: response,
    };
  }

  async fetchPaymentStatus(input: FetchPaymentStatusInput): Promise<FetchPaymentStatusResult> {
    const response = await this.request(`/v2/checkout/orders/${input.providerOrderToken}`, {
      method: 'GET',
    });

    return {
      provider: this.name,
      providerOrderToken: input.providerOrderToken,
      providerCaptureId: readString(response, ['purchase_units', '0', 'payments', 'captures', '0', 'id']),
      providerOrderStatus: readString(response, ['status']),
      providerPaymentStatus: readString(response, ['purchase_units', '0', 'payments', 'captures', '0', 'status']),
      paidAt: readDate(response, ['purchase_units', '0', 'payments', 'captures', '0', 'create_time']),
      expiresAt: null,
      rawResponse: response,
    };
  }

  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentResult> {
    const response = await this.request(`/v2/checkout/orders/${input.providerOrderToken}/capture`, {
      method: 'POST',
      body: {},
    });

    return {
      provider: this.name,
      providerOrderToken: input.providerOrderToken,
      providerCaptureId: readString(response, ['purchase_units', '0', 'payments', 'captures', '0', 'id']),
      providerOrderStatus: readString(response, ['status']),
      providerPaymentStatus: readString(response, ['purchase_units', '0', 'payments', 'captures', '0', 'status']),
      paidAt: readDate(response, ['purchase_units', '0', 'payments', 'captures', '0', 'create_time']),
      expiresAt: null,
      rawResponse: response,
    };
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentResult> {
    const captureId = input.providerCaptureId
      ?? (input.providerOrderToken
        ? await this.resolveCaptureIdFromOrder(input.providerOrderToken)
        : null);

    if (!captureId) {
      throw new InternalServerErrorException(
        'PayPal no devolvio un identificador de captura para reembolsar.',
      );
    }

    const response = await this.request(`/v2/payments/captures/${captureId}/refund`, {
      method: 'POST',
      body: {},
    });

    return {
      provider: this.name,
      providerOrderToken: input.providerOrderToken,
      providerCaptureId: captureId,
      providerOrderStatus: null,
      providerPaymentStatus: readString(response, ['status']),
      refundedAt: readDate(response, ['update_time']) ?? readDate(response, ['create_time']),
      rawResponse: response,
    };
  }

  private async resolveCaptureIdFromOrder(providerOrderToken: string): Promise<string | null> {
    const response = await this.request(`/v2/checkout/orders/${providerOrderToken}`, {
      method: 'GET',
    });

    return readString(response, ['purchase_units', '0', 'payments', 'captures', '0', 'id']);
  }

  private buildRedirectUrls(input: CreatePaymentCheckoutInput) {
    const webOrigin = this.environment.webAppOrigins[0] ?? 'http://localhost:3000';
    const successUrl = new URL(input.successPath ?? '/viajes', webOrigin);
    const successParams = input.successParams ?? {
      paymentId: input.paymentId,
      paymentProvider: 'paypal',
    };
    Object.entries(successParams).forEach(([key, value]) => {
      successUrl.searchParams.set(key, value);
    });

    const cancelUrl = new URL(input.cancelPath ?? input.successPath ?? '/viajes', webOrigin);
    const cancelParams = input.cancelParams ?? {
      paymentId: input.paymentId,
      paymentProvider: 'paypal',
      paymentResult: 'cancel',
    };
    Object.entries(cancelParams).forEach(([key, value]) => {
      cancelUrl.searchParams.set(key, value);
    });

    return {
      success: successUrl.toString(),
      cancel: cancelUrl.toString(),
    };
  }

  private async request(path: string, init: { method: 'GET' | 'POST'; body?: unknown }) {
    const accessToken = await this.getAccessToken();

    const response = await fetch(`${trimTrailingSlash(this.environment.paypalApiBaseUrl)}${path}`, {
      method: init.method,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        readString(payload, ['message'])
        ?? readString(payload, ['details', '0', 'description'])
        ?? 'PayPal rechazo la solicitud.';
      throw new InternalServerErrorException(message);
    }

    return payload;
  }

  private async getAccessToken(): Promise<string> {
    const basicToken = Buffer.from(
      `${this.environment.paypalClientId ?? ''}:${this.environment.paypalClientSecret ?? ''}`,
    ).toString('base64');

    const response = await fetch(
      `${trimTrailingSlash(this.environment.paypalApiBaseUrl)}/v1/oauth2/token`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Basic ${basicToken}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      },
    );

    const payload = (await response.json().catch(() => null)) as PaypalAccessTokenResponse | null;

    if (!response.ok || !payload?.access_token) {
      throw new InternalServerErrorException(
        'No fue posible autenticarse con PayPal.',
      );
    }

    return payload.access_token;
  }
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function readString(payload: unknown, path: string[]): string | null {
  const value = readNestedValue(payload, path);

  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readDate(payload: unknown, path: string[]): Date | null {
  const rawValue = readString(payload, path);

  if (!rawValue) {
    return null;
  }

  const parsedDate = new Date(rawValue);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function findFirstLink(payload: unknown, rels: string[]): string | null {
  const links = readNestedValue(payload, ['links']);

  if (!Array.isArray(links)) {
    return null;
  }

  for (const rel of rels) {
    const link = links.find(
      (item) =>
        item
        && typeof item === 'object'
        && (item as Record<string, unknown>).rel === rel
        && typeof (item as Record<string, unknown>).href === 'string',
    ) as Record<string, unknown> | undefined;

    if (typeof link?.href === 'string' && link.href.trim().length > 0) {
      return link.href;
    }
  }

  return null;
}

function readNestedValue(payload: unknown, path: string[]): unknown {
  let currentValue: unknown = payload;

  for (const key of path) {
    if (Array.isArray(currentValue)) {
      const index = Number.parseInt(key, 10);

      if (Number.isNaN(index)) {
        return null;
      }

      currentValue = currentValue[index];
      continue;
    }

    if (!currentValue || typeof currentValue !== 'object' || !(key in currentValue)) {
      return null;
    }

    currentValue = (currentValue as Record<string, unknown>)[key];
  }

  return currentValue;
}
