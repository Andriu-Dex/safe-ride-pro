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
      message: 'Cuenta creada correctamente. Usa el código de verificación para activarla.',
      deliveryChannel: 'development_preview',
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
    await user.type(screen.getByPlaceholderText('Mínimo 8 caracteres'), 'Password123');
    await user.type(screen.getByPlaceholderText('Repite tu clave'), 'Password123');
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
      '/verify-email?email=nuevo%40uta.edu.ec&code=654321',
    );
  });

  it('redirects without a debug code when the verification email was delivered for real', async () => {
    vi.mocked(register).mockResolvedValue({
      message: 'Cuenta creada correctamente. Revisa tu correo para verificar la cuenta.',
      deliveryChannel: 'email',
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
    await user.type(screen.getByPlaceholderText('Mínimo 8 caracteres'), 'Password123');
    await user.type(screen.getByPlaceholderText('Repite tu clave'), 'Password123');
    await user.type(screen.getByPlaceholderText('0102030405'), '1710034065');
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/verify-email?email=nuevo%40uta.edu.ec');
    });
  });

  it('shows validation message when passwords do not match on submit', async () => {
    render(<RegisterForm />);

    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText('Nombres y apellidos'), 'Nuevo Usuario');
    await user.type(screen.getByPlaceholderText('tu-correo@institucion.edu'), 'nuevo@uta.edu.ec');
    await user.type(screen.getByPlaceholderText('Mínimo 8 caracteres'), 'Password123');
    await user.type(screen.getByPlaceholderText('Repite tu clave'), 'Password999');
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(screen.getAllByText('La confirmación de contraseña no coincide.').length).toBeGreaterThan(0);
    expect(register).not.toHaveBeenCalled();
  });

  it('shows the API error message when register fails', async () => {
    vi.mocked(register).mockRejectedValue(new ApiError('Ya existe una cuenta registrada con este correo.', 409));

    render(<RegisterForm />);

    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText('Nombres y apellidos'), 'Nuevo Usuario');
    await user.type(screen.getByPlaceholderText('tu-correo@institucion.edu'), 'nuevo@uta.edu.ec');
    await user.type(screen.getByPlaceholderText('Mínimo 8 caracteres'), 'Password123');
    await user.type(screen.getByPlaceholderText('Repite tu clave'), 'Password123');
    await user.type(screen.getByPlaceholderText('0102030405'), '1710034065');
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(await screen.findByText('Ya existe una cuenta registrada con este correo.')).toBeInTheDocument();
  });

  it('shows validation message when the Ecuadorian national id is invalid on submit', async () => {
    render(<RegisterForm />);

    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText('Nombres y apellidos'), 'Nuevo Usuario');
    await user.type(screen.getByPlaceholderText('tu-correo@institucion.edu'), 'nuevo@uta.edu.ec');
    await user.type(screen.getByPlaceholderText('Mínimo 8 caracteres'), 'Password123');
    await user.type(screen.getByPlaceholderText('Repite tu clave'), 'Password123');
    await user.type(screen.getByPlaceholderText('0102030405'), '0102030405');
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(screen.getAllByText('La cédula ecuatoriana no es válida.').length).toBeGreaterThan(0);
    expect(register).not.toHaveBeenCalled();
  });

  it('shows validation message when the phone does not start with 09', async () => {
    render(<RegisterForm />);

    const user = userEvent.setup();

    await user.type(screen.getByPlaceholderText('Nombres y apellidos'), 'Nuevo Usuario');
    await user.type(screen.getByPlaceholderText('tu-correo@institucion.edu'), 'nuevo@uta.edu.ec');
    await user.type(screen.getByPlaceholderText('Mínimo 8 caracteres'), 'Password123');
    await user.type(screen.getByPlaceholderText('Repite tu clave'), 'Password123');
    await user.type(screen.getByPlaceholderText('0102030405'), '1710034065');
    await user.type(screen.getByPlaceholderText('0999999999'), '0812345678');
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

    expect(screen.getAllByText('El celular debe tener 10 dígitos y empezar con 09.').length).toBeGreaterThan(0);
    expect(register).not.toHaveBeenCalled();
  });

  it('lets the user reveal the password', async () => {
    render(<RegisterForm />);

    const user = userEvent.setup();

    const passwordInput = screen.getByLabelText('Clave de acceso');

    await user.type(passwordInput, 'Password123');

    expect(screen.getByText('Media')).toBeInTheDocument();
    expect(screen.getByText('Buena base. Puedes reforzarla con un símbolo.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Mostrar clave' }));

    expect(screen.getByLabelText('Clave de acceso')).toHaveAttribute('type', 'text');
  });

  it('shows the email validation when the field loses focus with an invalid value', async () => {
    render(<RegisterForm />);

    const user = userEvent.setup();

    const emailInput = screen.getByLabelText('Correo institucional');

    await user.type(emailInput, 'correo-invalido');
    await user.tab();

    expect(screen.getByText('Ingresa un correo institucional válido.')).toBeInTheDocument();
  });

  it('rejects public email providers on blur', async () => {
    render(<RegisterForm />);

    const user = userEvent.setup();

    const emailInput = screen.getByLabelText('Correo institucional');

    await user.type(emailInput, 'andriudex@gmail.com');
    await user.tab();

    expect(
      screen.getByText('Debes usar un correo institucional, no un proveedor público.'),
    ).toBeInTheDocument();
  });
});
