import { PaymentsController } from '../../../src/modules/payments/presentation/controllers/payments.controller';
import { CapturePaymentUseCase } from '../../../src/modules/payments/application/use-cases/capture-payment.use-case';
import { ConfirmCashPaymentUseCase } from '../../../src/modules/payments/application/use-cases/confirm-cash-payment.use-case';
import { CreatePaymentCheckoutLinkUseCase } from '../../../src/modules/payments/application/use-cases/create-payment-checkout-link.use-case';
import { RefreshPaymentStatusUseCase } from '../../../src/modules/payments/application/use-cases/refresh-payment-status.use-case';
import { ReportCashPaymentIssueUseCase } from '../../../src/modules/payments/application/use-cases/report-cash-payment-issue.use-case';
import { CurrentUserContext } from '../../../src/modules/auth/application/types/current-user-context.type';
import { GlobalUserRole } from '@saferidepro/shared-types';

describe('PaymentsController', () => {
  let controller: PaymentsController;
  let capturePaymentUseCase: jest.Mocked<CapturePaymentUseCase>;
  let confirmCashPaymentUseCase: jest.Mocked<ConfirmCashPaymentUseCase>;
  let createPaymentCheckoutLinkUseCase: jest.Mocked<CreatePaymentCheckoutLinkUseCase>;
  let refreshPaymentStatusUseCase: jest.Mocked<RefreshPaymentStatusUseCase>;
  let reportCashPaymentIssueUseCase: jest.Mocked<ReportCashPaymentIssueUseCase>;

  beforeEach(() => {
    capturePaymentUseCase = { execute: jest.fn() } as any;
    confirmCashPaymentUseCase = { execute: jest.fn() } as any;
    createPaymentCheckoutLinkUseCase = { execute: jest.fn() } as any;
    refreshPaymentStatusUseCase = { execute: jest.fn() } as any;
    reportCashPaymentIssueUseCase = { execute: jest.fn() } as any;

    controller = new PaymentsController(
      capturePaymentUseCase,
      createPaymentCheckoutLinkUseCase,
      refreshPaymentStatusUseCase,
      confirmCashPaymentUseCase,
      reportCashPaymentIssueUseCase,
    );
  });

  const buildUser = (): CurrentUserContext => ({
    id: 'user-1',
  } as any);

  it('calls reportCashPaymentIssueUseCase (covers line 72)', async () => {
    reportCashPaymentIssueUseCase.execute.mockResolvedValue('reported' as any);
    const user = buildUser();
    const result = await controller.reportCashPaymentIssue(user, 'payment-1', { note: 'Driver did not have change' });
    expect(reportCashPaymentIssueUseCase.execute).toHaveBeenCalledWith('user-1', 'payment-1', 'Driver did not have change');
    expect(result).toBe('reported');
  });
});
