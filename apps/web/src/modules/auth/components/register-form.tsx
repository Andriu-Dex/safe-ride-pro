'use client';

import { DocumentType, isValidEcuadorianNationalId } from '@saferidepro/shared-types';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Button } from '../../../components/ui/button';
import { InputField } from '../../../components/ui/input-field';
import { SelectField } from '../../../components/ui/select-field';
import { register, ApiError } from '../lib/auth-api';

type RegisterFormValues = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  documentType: DocumentType;
  documentNumber: string;
  phone: string;
};

const INITIAL_VALUES: RegisterFormValues = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  documentType: DocumentType.NationalId,
  documentNumber: '',
  phone: '',
};

export function RegisterForm() {
  const router = useRouter();
  const [values, setValues] = useState(INITIAL_VALUES);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validationIssues = useMemo(() => {
    const issues: string[] = [];
    const normalizedEmail = values.email.trim().toLowerCase();

    if (values.fullName.trim().length < 5) {
      issues.push('Ingresa tu nombre completo para continuar.');
    }

    if (!normalizedEmail.includes('@')) {
      issues.push('Debes usar un correo institucional valido.');
    }

    if (values.password.length < 8) {
      issues.push('La contrasena debe tener al menos 8 caracteres.');
    }

    if (values.password !== values.confirmPassword) {
      issues.push('La confirmacion de contrasena no coincide.');
    }

    if (!values.documentNumber.trim()) {
      issues.push('Debes indicar un numero de documento.');
    }

    if (values.documentType === DocumentType.NationalId && values.documentNumber.trim()) {
      const normalizedNationalId = values.documentNumber.trim();

      if (!/^\d{10}$/.test(normalizedNationalId)) {
        issues.push('La cedula debe tener exactamente 10 digitos.');
      } else if (!isValidEcuadorianNationalId(normalizedNationalId)) {
        issues.push('La cedula ecuatoriana no es valida.');
      }
    }

    return issues;
  }, [values]);

  const canSubmit = !isSubmitting && validationIssues.length === 0;

  const handleChange = (
    field: keyof RegisterFormValues,
    value: string,
  ) => {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!canSubmit) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await register({
        email: values.email.trim().toLowerCase(),
        password: values.password,
        fullName: values.fullName.trim(),
        phone: values.phone.trim() || undefined,
        documentType: values.documentType,
        documentNumber: values.documentNumber.trim(),
      });

      setSuccessMessage(response.message);

      const query = new URLSearchParams({
        email: response.user.email,
      });

      if (response.verificationCode) {
        query.set('code', response.verificationCode);
      }

      router.replace(`/verify-email?${query.toString()}`);
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('No fue posible crear la cuenta en este momento.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="form-card">
      <div className="form-header">
        <p className="kicker">Registro institucional</p>
        <h2>Crea tu cuenta</h2>
        <p>
          Registra tus datos base para crear tu acceso institucional.
        </p>
      </div>

      <form className="form-stack" onSubmit={handleSubmit}>
        <div className="form-grid form-grid-2">
          <InputField
            autoComplete="name"
            label="Nombre completo"
            onChange={(event) => handleChange('fullName', event.target.value)}
            placeholder="Nombres y apellidos"
            required
            value={values.fullName}
          />
          <InputField
            autoComplete="email"
            hint="Debe pertenecer a un dominio institucional habilitado."
            label="Correo institucional"
            onChange={(event) => handleChange('email', event.target.value)}
            placeholder="tu-correo@institucion.edu"
            required
            type="email"
            value={values.email}
          />
        </div>

        <div className="form-grid form-grid-2">
          <InputField
            autoComplete="new-password"
            label="Contrasena"
            onChange={(event) => handleChange('password', event.target.value)}
            placeholder="Minimo 8 caracteres"
            required
            type="password"
            value={values.password}
          />
          <InputField
            autoComplete="new-password"
            label="Confirmar contrasena"
            onChange={(event) => handleChange('confirmPassword', event.target.value)}
            placeholder="Repite tu contrasena"
            required
            type="password"
            value={values.confirmPassword}
          />
        </div>

        <div className="form-grid form-grid-2">
          <SelectField
            label="Tipo de documento"
            onChange={(event) => handleChange('documentType', event.target.value)}
            required
            value={values.documentType}
          >
            <option value={DocumentType.NationalId}>Cedula</option>
            <option value={DocumentType.Passport}>Pasaporte</option>
          </SelectField>

          <InputField
            hint={
              values.documentType === DocumentType.NationalId
                ? 'Validamos que la cedula ecuatoriana tenga formato y digito verificador correctos.'
                : undefined
            }
            label="Numero de documento"
            onChange={(event) => handleChange('documentNumber', event.target.value)}
            placeholder="0102030405"
            required
            value={values.documentNumber}
          />
        </div>

        <InputField
          hint="Opcional. Sirve para contacto operativo dentro del sistema."
          label="Telefono"
          onChange={(event) => handleChange('phone', event.target.value)}
          placeholder="0999999999"
          value={values.phone}
        />

        {validationIssues.length ? (
          <div className="validation-card validation-card-danger">
            <strong>Antes de continuar:</strong>
            <ul className="validation-list">
              {validationIssues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {errorMessage ? <div className="form-error">{errorMessage}</div> : null}
        {successMessage ? <div className="form-success">{successMessage}</div> : null}

        <Button disabled={!canSubmit} type="submit">
          {isSubmitting ? 'Creando cuenta...' : 'Crear cuenta'}
        </Button>
      </form>

      <div className="button-row">
        <a className="button button-secondary" href="/login">
          Ya tengo una cuenta
        </a>
      </div>
    </div>
  );
}
