import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ResetPasswordForm } from './reset-password-form';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
}));

describe('ResetPasswordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows password strength feedback and lets the user reveal the new password', async () => {
    render(<ResetPasswordForm />);

    const user = userEvent.setup();
    const passwordInput = screen.getByLabelText('Nueva contrasena');

    await user.type(passwordInput, 'Password123');

    expect(screen.getByText('Media')).toBeInTheDocument();
    expect(
      screen.getByText('Buena base. Puedes reforzarla con un simbolo.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mostrar nueva contrasena' }));

    expect(screen.getByLabelText('Nueva contrasena')).toHaveAttribute('type', 'text');
  });
});
