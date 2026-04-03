'use client';

import {
  DocumentType,
  isValidEcuadorianMobilePhone,
  isValidEcuadorianNationalId,
} from '@saferidepro/shared-types';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Button } from '../../../components/ui/button';
import { InputField } from '../../../components/ui/input-field';
import { PasswordField } from '../../../components/ui/password-field';
import { SelectField } from '../../../components/ui/select-field';
import { StatusPill } from '../../../components/ui/status-pill';
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

type RegisterFormField =
  | 'fullName'
  | 'email'
  | 'password'
  | 'confirmPassword'
  | 'documentType'
  | 'documentNumber'
  | 'phone';

type DocumentValidationState = {
  hasValue: boolean;
  hasValidNationalIdFormat: boolean;
  hasValidNationalIdChecksum: boolean;
};

type PasswordStrength = {
  label: string;
  tone: 'danger' | 'warning' | 'success';
  description: string;
  progress: number;
};

const MIN_FULL_NAME_LENGTH = 5;
const MIN_PASSWORD_LENGTH = 8;
const NATIONAL_ID_LENGTH = 10;
const NATIONAL_ID_PATTERN = /^\d{10}$/;
const PUBLIC_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'yahoo.com',
  'yahoo.es',
  'icloud.com',
  'me.com',
  'aol.com',
  'proton.me',
  'protonmail.com',
  'gmx.com',
  'zoho.com',
]);

const INITIAL_VALUES: RegisterFormValues = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
  documentType: DocumentType.NationalId,
  documentNumber: '',
  phone: '',
};

const FIELD_ORDER: RegisterFormField[] = [
  'fullName',
  'email',
  'documentType',
  'documentNumber',
  'phone',
  'password',
  'confirmPassword',
];

function validateDocument(
  documentType: DocumentType,
  documentNumber: string,
): DocumentValidationState {
  const normalizedDocumentNumber = documentNumber.trim();

  if (!normalizedDocumentNumber) {
    return {
      hasValue: false,
      hasValidNationalIdFormat: false,
      hasValidNationalIdChecksum: false,
    };
  }

  if (documentType !== DocumentType.NationalId) {
    return {
      hasValue: true,
      hasValidNationalIdFormat: true,
      hasValidNationalIdChecksum: true,
    };
  }

  const hasValidNationalIdFormat = NATIONAL_ID_PATTERN.test(normalizedDocumentNumber);
  const hasValidNationalIdChecksum =
    hasValidNationalIdFormat && isValidEcuadorianNationalId(normalizedDocumentNumber);

  return {
    hasValue: true,
    hasValidNationalIdFormat,
    hasValidNationalIdChecksum,
  };
}

function getPasswordStrength(password: string): PasswordStrength | null {
  if (!password) {
    return null;
  }

  let score = 0;

  if (password.length >= MIN_PASSWORD_LENGTH) {
    score += 1;
  }

  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) {
    score += 1;
  }

  if (/\d/.test(password)) {
    score += 1;
  }

  if (/[^A-Za-z0-9]/.test(password) || password.length >= 12) {
    score += 1;
  }

  const progress = Math.max(score, 1) * 25;

  if (score <= 1) {
    return {
      label: 'Baja',
      tone: 'danger',
      description: 'Agrega mayusculas, numeros o mayor longitud.',
      progress,
    };
  }

  if (score <= 3) {
    return {
      label: 'Media',
      tone: 'warning',
      description: 'Buena base. Puedes reforzarla con un simbolo.',
      progress,
    };
  }

  return {
    label: 'Alta',
    tone: 'success',
    description: 'Clave segura para continuar.',
    progress,
  };
}

export function RegisterForm() {
  const router = useRouter();
  const [values, setValues] = useState(INITIAL_VALUES);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Record<RegisterFormField, boolean>>({
    fullName: false,
    email: false,
    password: false,
    confirmPassword: false,
    documentType: false,
    documentNumber: false,
    phone: false,
  });
  const documentValidation = useMemo(
    () => validateDocument(values.documentType, values.documentNumber),
    [values.documentNumber, values.documentType],
  );
  const passwordStrength = useMemo(() => getPasswordStrength(values.password), [values.password]);

  const validationIssues = useMemo(() => {
    const issues: string[] = [];
    const normalizedEmail = values.email.trim().toLowerCase();

    if (values.fullName.trim().length < MIN_FULL_NAME_LENGTH) {
      issues.push('Ingresa tu nombre completo para continuar.');
    }

    if (!normalizedEmail.includes('@')) {
      issues.push('Debes usar un correo institucional válido.');
    }

    if (values.password.length < MIN_PASSWORD_LENGTH) {
      issues.push('La contraseña debe tener al menos 8 caracteres.');
    }

    if (values.password !== values.confirmPassword) {
      issues.push('La confirmación de contraseña no coincide.');
    }

    if (!documentValidation.hasValue) {
      issues.push('Debes indicar un número de documento.');
    }

    if (values.documentType === DocumentType.NationalId && documentValidation.hasValue) {
      if (!documentValidation.hasValidNationalIdFormat) {
        issues.push('La cédula debe tener exactamente 10 dígitos.');
      } else if (!documentValidation.hasValidNationalIdChecksum) {
        issues.push('La cédula ecuatoriana no es válida.');
      }
    }

    if (values.phone.trim() && !isValidEcuadorianMobilePhone(values.phone)) {
      issues.push('El celular debe tener 10 dígitos y empezar con 09.');
    }

    return issues;
  }, [
    documentValidation.hasValidNationalIdChecksum,
    documentValidation.hasValidNationalIdFormat,
    documentValidation.hasValue,
    values.confirmPassword,
    values.documentType,
    values.email,
    values.fullName,
    values.phone,
    values.password,
  ]);

  const canSubmit = !isSubmitting;
  const shouldShowValidationIssues = hasAttemptedSubmit && validationIssues.length > 0;

  const emailError = useMemo(() => {
    const normalizedEmail = values.email.trim().toLowerCase();

    if (!normalizedEmail) {
      return 'Debes ingresar tu correo institucional.';
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return 'Ingresa un correo institucional válido.';
    }

    const domain = normalizedEmail.split('@')[1];

    if (domain && PUBLIC_EMAIL_DOMAINS.has(domain)) {
      return 'Debes usar un correo institucional, no un proveedor publico.';
    }

    return null;
  }, [values.email]);

  const fullNameError = useMemo(() => {
    if (!values.fullName.trim()) {
      return 'Debes ingresar tu nombre completo.';
    }

    if (values.fullName.trim().length < MIN_FULL_NAME_LENGTH) {
      return 'Ingresa nombres y apellidos completos.';
    }

    return null;
  }, [values.fullName]);

  const documentTypeError = useMemo(() => {
    if (!values.documentType) {
      return 'Selecciona un tipo de documento.';
    }

    return null;
  }, [values.documentType]);

  const documentNumberError = useMemo(() => {
    if (!documentValidation.hasValue) {
      return 'Debes indicar un número de documento.';
    }

    if (values.documentType === DocumentType.NationalId) {
      if (!documentValidation.hasValidNationalIdFormat) {
        return 'La cédula debe tener exactamente 10 dígitos.';
      }

      if (!documentValidation.hasValidNationalIdChecksum) {
        return 'La cédula ecuatoriana no es válida.';
      }
    }

    return null;
  }, [
    documentValidation.hasValidNationalIdChecksum,
    documentValidation.hasValidNationalIdFormat,
    documentValidation.hasValue,
    values.documentType,
  ]);

  const phoneError = useMemo(() => {
    if (!values.phone.trim()) {
      return null;
    }

    if (!isValidEcuadorianMobilePhone(values.phone)) {
      return 'El celular debe tener 10 dígitos y empezar con 09.';
    }

    return null;
  }, [values.phone]);

  const passwordError = useMemo(() => {
    if (!values.password) {
      return 'Debes crear una contraseña.';
    }

    if (values.password.length < MIN_PASSWORD_LENGTH) {
      return 'La contraseña debe tener al menos 8 caracteres.';
    }

    return null;
  }, [values.password]);

  const confirmPasswordError = useMemo(() => {
    if (!values.confirmPassword) {
      return 'Debes confirmar la contraseña.';
    }

    if (values.password !== values.confirmPassword) {
      return 'La confirmación de contraseña no coincide.';
    }

    return null;
  }, [values.confirmPassword, values.password]);

  const fieldErrors: Record<RegisterFormField, string | null> = {
    fullName: fullNameError,
    email: emailError,
    documentType: documentTypeError,
    documentNumber: documentNumberError,
    phone: phoneError,
    password: passwordError,
    confirmPassword: confirmPasswordError,
  };

  const getVisibleFieldError = (field: RegisterFormField): string | null =>
    touchedFields[field] || hasAttemptedSubmit ? fieldErrors[field] : null;

  const handleChange = (
    field: keyof RegisterFormValues,
    value: string,
  ) => {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }));
  };

  const markFieldAsTouched = (field: RegisterFormField) => {
    setTouchedFields((currentValue) => ({
      ...currentValue,
      [field]: true,
    }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setHasAttemptedSubmit(true);
    setTouchedFields((currentValue) =>
      FIELD_ORDER.reduce<Record<RegisterFormField, boolean>>(
        (result, field) => ({
          ...result,
          [field]: true,
        }),
        currentValue,
      ),
    );
    setErrorMessage(null);
    setSuccessMessage(null);

    if (validationIssues.length > 0) {
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

      if (
        response.deliveryChannel === 'development_preview' &&
        response.verificationCode
      ) {
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
    <div className="form-card register-form-card">
      <div className="form-header register-form-header">
        <p className="kicker">Registro institucional</p>
        <h2>Completa el formulario</h2>
        <p>Solo necesitamos los datos esenciales para crear tu cuenta.</p>
      </div>

      <form className="form-stack register-form-stack register-form-vertical" noValidate onSubmit={handleSubmit}>
        <InputField
          autoComplete="name"
          error={getVisibleFieldError('fullName')}
          label="Nombre completo"
          onBlur={() => markFieldAsTouched('fullName')}
          onChange={(event) => handleChange('fullName', event.target.value)}
          placeholder="Nombres y apellidos"
          required
          value={values.fullName}
        />

        <InputField
          autoComplete="email"
          error={getVisibleFieldError('email')}
          label="Correo institucional"
          onBlur={() => markFieldAsTouched('email')}
          onChange={(event) => handleChange('email', event.target.value)}
          placeholder="tu-correo@institucion.edu"
          required
          type="email"
          value={values.email}
        />

        <SelectField
          error={getVisibleFieldError('documentType')}
          label="Tipo de documento"
          onBlur={() => markFieldAsTouched('documentType')}
          onChange={(event) => handleChange('documentType', event.target.value)}
          required
          value={values.documentType}
        >
          <option value={DocumentType.NationalId}>Cedula</option>
          <option value={DocumentType.Passport}>Pasaporte</option>
        </SelectField>

        <InputField
          error={getVisibleFieldError('documentNumber')}
          inputMode={values.documentType === DocumentType.NationalId ? 'numeric' : undefined}
          label="Numero de documento"
          maxLength={values.documentType === DocumentType.NationalId ? NATIONAL_ID_LENGTH : 20}
          onBlur={() => markFieldAsTouched('documentNumber')}
          onChange={(event) => handleChange('documentNumber', event.target.value)}
          placeholder="0102030405"
          required
          value={values.documentNumber}
        />

        <InputField
          error={getVisibleFieldError('phone')}
          inputMode="tel"
          label="Telefono (opcional)"
          onBlur={() => markFieldAsTouched('phone')}
          onChange={(event) => handleChange('phone', event.target.value)}
          placeholder="0999999999"
          value={values.phone}
        />

        <PasswordField
          autoComplete="new-password"
          error={getVisibleFieldError('password')}
          label="Clave de acceso"
          hideLabel="Ocultar clave"
          onBlur={() => markFieldAsTouched('password')}
          onChange={(event) => handleChange('password', event.target.value)}
          placeholder="Minimo 8 caracteres"
          required
          showLabel="Mostrar clave"
          value={values.password}
        />

        <PasswordField
          autoComplete="new-password"
          error={getVisibleFieldError('confirmPassword')}
          label="Confirmar clave"
          hideLabel="Ocultar confirmacion de clave"
          onBlur={() => markFieldAsTouched('confirmPassword')}
          onChange={(event) => handleChange('confirmPassword', event.target.value)}
          placeholder="Repite tu clave"
          required
          showLabel="Mostrar confirmacion de clave"
          value={values.confirmPassword}
        />

        {passwordStrength ? (
          <div className="password-strength-card" aria-live="polite">
            <div className="password-strength-header">
              <strong>Seguridad de la clave</strong>
              <StatusPill label={passwordStrength.label} tone={passwordStrength.tone} />
            </div>
            <div aria-hidden="true" className="password-strength-meter">
              <span
                className={[
                  'password-strength-fill',
                  `password-strength-fill-${passwordStrength.tone}`,
                ].join(' ')}
                style={{ width: `${passwordStrength.progress}%` }}
              />
            </div>
            <p className="password-strength-text">{passwordStrength.description}</p>
          </div>
        ) : null}

        {shouldShowValidationIssues ? (
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

        <Button className="register-submit-button" disabled={!canSubmit} type="submit">
          {isSubmitting ? 'Creando cuenta...' : 'Crear cuenta'}
        </Button>
      </form>

      <div className="button-row register-secondary-action">
        <a className="button button-secondary" href="/login">
          Ya tengo una cuenta
        </a>
      </div>
    </div>
  );
}
