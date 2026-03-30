import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, register } from '../lib/auth-api';
import { RegisterForm } from './register-form';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
}));

vi.mock('../lib/auth-api', async () => {
  const actual = await vi.importActual<typeof import('../lib/auth-api')>('../lib/auth-api');

  return {
    ...actual,
    register: vi.fn(),
  };
});

describe('RegisterForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registers the user and redirects to verify-email', async () => {
    vi.mocked(register).mockResolvedValue({
      message: 'Cuenta creada correctamente. Usa el codigo de verificacion para activarla.',
      verificationCode: '654321',
      user: {
        id: 'user-1',
        email: 'nuevo@uta.edu.ec',
        fullName: 'Nuevo Usuario',
      },
    });

    render(<RegisterForm />);

    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText('Nombres y apellidos'), 'Nuevo Usuario');
    await user.type(screen.getByPlaceholderText('tu-correo@institucion.edu'), 'nuevo@uta.edu.ec');
    await user.type(screen.getByPlaceholderText('Minimo 8 caracteres'), 'Password123');
    await user.type(screen.getByPlaceholderText('Repite tu contrasena'), 'Password123');
    await user.type(screen.getByPlaceholderText('0102030405'), '1710034065');
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    await waitFor(() => {
      expect(register).toHaveBeenCalledWith({
        email: 'nuevo@uta.edu.ec',
        password: 'Password123',
        fullName: 'Nuevo Usuario',
        phone: undefined,
        documentType: 'NATIONAL_ID',
        documentNumber: '1710034065',
      });
    });

    expect(replaceMock).toHaveBeenCalledWith(
      '/verify-email?code=654321&email=nuevo%40uta.edu.ec',
    );
  });

  it('blocks submit when passwords do not match', async () => {
    render(<RegisterForm />);

    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText('Nombres y apellidos'), 'Nuevo Usuario');
    await user.type(screen.getByPlaceholderText('tu-correo@institucion.edu'), 'nuevo@uta.edu.ec');
    await user.type(screen.getByPlaceholderText('Minimo 8 caracteres'), 'Password123');
    await user.type(screen.getByPlaceholderText('Repite tu contrasena'), 'Password999');

    expect(
      screen.getByText('La confirmacion de contrasena no coincide.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeDisabled();
  });

  it('shows the API error message when register fails', async () => {
    vi.mocked(register).mockRejectedValue(new ApiError('Ya existe una cuenta registrada con este correo.', 409));

    render(<RegisterForm />);

    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText('Nombres y apellidos'), 'Nuevo Usuario');
    await user.type(screen.getByPlaceholderText('tu-correo@institucion.edu'), 'nuevo@uta.edu.ec');
    await user.type(screen.getByPlaceholderText('Minimo 8 caracteres'), 'Password123');
    await user.type(screen.getByPlaceholderText('Repite tu contrasena'), 'Password123');
    await user.type(screen.getByPlaceholderText('0102030405'), '1710034065');
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByText('Ya existe una cuenta registrada con este correo.')).toBeInTheDocument();
  });

  it('blocks submit when the Ecuadorian national id is invalid', async () => {
    render(<RegisterForm />);

    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText('Nombres y apellidos'), 'Nuevo Usuario');
    await user.type(screen.getByPlaceholderText('tu-correo@institucion.edu'), 'nuevo@uta.edu.ec');
    await user.type(screen.getByPlaceholderText('Minimo 8 caracteres'), 'Password123');
    await user.type(screen.getByPlaceholderText('Repite tu contrasena'), 'Password123');
    await user.type(screen.getByPlaceholderText('0102030405'), '0102030405');

    expect(screen.getByText('La cedula ecuatoriana no es valida.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeDisabled();
  });
});
