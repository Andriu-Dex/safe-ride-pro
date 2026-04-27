'use client';

import {
  DocumentType,
  isValidEcuadorianMobilePhone,
  isValidEcuadorianNationalId,
} from '@saferidepro/shared-types';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { Button } from '../../../components/ui/button';
import { persistToast } from '../../../components/ui/flash-toast';
import { InputField } from '../../../components/ui/input-field';
import { PasswordField } from '../../../components/ui/password-field';
import { SelectField } from '../../../components/ui/select-field';
import { StatusPill } from '../../../components/ui/status-pill';
import { ToastItem, ToastStack } from '../../../components/ui/toast-stack';
import { register, ApiError } from '../lib/auth-api';
import styles from './register-form.module.css';

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
      description: 'Agrega mayúsculas, números o mayor longitud.',
      progress,
    };
  }

  if (score <= 3) {
    return {
      label: 'Media',
      tone: 'warning',
      description: 'Buena base. Puedes reforzarla con un símbolo.',
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

type RegisterFormProps = {
  initialEmail?: string;
};

export function RegisterForm({ initialEmail = '' }: RegisterFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<RegisterFormValues>({
    ...INITIAL_VALUES,
    email: initialEmail,
  });
  const [toasts, setToasts] = useState<ToastItem[]>([]);
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
      return 'Se requiere un correo institucional autorizado.';
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

  const pushToast = (title: string, description: string, tone: ToastItem['tone'] = 'error') => {
    setToasts([
      {
        id: `register-toast-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        title,
        description,
        tone,
      },
    ]);
  };

  const dismissToast = (toastId: string) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== toastId));
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
    setToasts([]);

    if (validationIssues.length > 0) {
      pushToast(
        'Formulario incompleto',
        'Por favor, revisa los campos marcados en rojo antes de continuar.',
        'error',
      );
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

      persistToast({
        title: 'Registro exitoso',
        description: response.message,
        tone: 'success',
      });

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
        pushToast('Error de registro', error.message, 'error');
      } else {
        pushToast('Error de registro', 'No fue posible crear la cuenta en este momento.', 'error');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <ToastStack onDismiss={dismissToast} toasts={toasts} />
      <div className={`${styles.registerFormCard} form-card`}>
        <div className={`${styles.registerFormHeader} form-header`}>
          <p className={styles.kicker}>Registro institucional</p>
          <h2>Completa el formulario</h2>
          <p>Solo necesitamos los datos esenciales para crear tu cuenta.</p>
        </div>

        <form className={`${styles.registerFormStack} form-stack`} noValidate onSubmit={handleSubmit}>
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
            <option value={DocumentType.NationalId}>Cédula</option>
            <option value={DocumentType.Passport}>Pasaporte</option>
          </SelectField>

          <InputField
            error={getVisibleFieldError('documentNumber')}
            inputMode={values.documentType === DocumentType.NationalId ? 'numeric' : undefined}
            label="Número de documento"
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
            label="Teléfono (opcional)"
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
            placeholder="Mínimo 8 caracteres"
            required
            showLabel="Mostrar clave"
            value={values.password}
          />

          <PasswordField
            autoComplete="new-password"
            error={getVisibleFieldError('confirmPassword')}
            label="Confirmar clave"
            hideLabel="Ocultar confirmación de clave"
            onBlur={() => markFieldAsTouched('confirmPassword')}
            onChange={(event) => handleChange('confirmPassword', event.target.value)}
            placeholder="Repite tu clave"
            required
            showLabel="Mostrar confirmación de clave"
            value={values.confirmPassword}
          />

          {passwordStrength ? (
            <div className={styles.passwordStrengthCard} aria-live="polite">
              <div className={styles.passwordStrengthHeader}>
                <strong>Seguridad de la clave</strong>
                <StatusPill label={passwordStrength.label} tone={passwordStrength.tone} />
              </div>
              <div aria-hidden="true" className={styles.passwordStrengthMeter}>
                <span
                  className={[
                    styles.passwordStrengthFill,
                    passwordStrength.tone === 'danger'
                      ? styles.passwordStrengthFillDanger
                      : passwordStrength.tone === 'warning'
                        ? styles.passwordStrengthFillWarning
                        : styles.passwordStrengthFillSuccess,
                  ].join(' ')}
                  style={{ width: `${passwordStrength.progress}%` }}
                />
              </div>
              <p className={styles.passwordStrengthText}>{passwordStrength.description}</p>
            </div>
          ) : null}

          <Button className={styles.registerSubmitButton} disabled={!canSubmit} type="submit">
            {isSubmitting ? 'Creando cuenta...' : 'Crear cuenta'}
          </Button>
        </form>

        <div className="mt-6 flex flex-col items-center gap-3">
          <div className="flex items-center justify-center gap-3 text-sm text-slate-500">
            <button
              type="button"
              className="hover:text-slate-800 transition-colors"
              onClick={() => router.push('/login')}
            >
              Ya tengo una cuenta
            </button>
            {values.email.trim() ? (
              <>
                <span>•</span>
                <button
                  type="button"
                  className="hover:text-slate-800 transition-colors"
                  onClick={() => router.push(`/verify-email?email=${encodeURIComponent(values.email.trim().toLowerCase())}`)}
                >
                  Volver a verificación
                </button>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}
