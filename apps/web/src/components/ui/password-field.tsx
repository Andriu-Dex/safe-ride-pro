'use client';

import { useState } from 'react';

import { InputField } from './input-field';

type PasswordFieldProps = Omit<
  React.ComponentProps<typeof InputField>,
  'type' | 'trailingAction'
> & {
  showLabel?: string;
  hideLabel?: string;
};

function EyeIcon({ isVisible }: { isVisible: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="field-icon"
      fill="none"
      height="18"
      viewBox="0 0 24 24"
      width="18"
    >
      <path
        d={
          isVisible
            ? 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z'
            : 'M3 4.5 20 19.5'
        }
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      {isVisible ? (
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
      ) : (
        <>
          <path
            d="M10.58 6.24A10.93 10.93 0 0 1 12 6c6.5 0 10 6 10 6a18.7 18.7 0 0 1-3.05 3.6M6.71 8.7A18.08 18.08 0 0 0 2 12s3.5 6 10 6c1.73 0 3.22-.42 4.5-1.04"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
          <path
            d="M9.88 9.88A3 3 0 0 0 14.12 14.12"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.8"
          />
        </>
      )}
    </svg>
  );
}

export function PasswordField({
  showLabel = 'Mostrar clave',
  hideLabel = 'Ocultar clave',
  ...props
}: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <InputField
      {...props}
      trailingAction={
        <button
          aria-label={isVisible ? hideLabel : showLabel}
          className="field-action-button"
          onClick={() => setIsVisible((currentValue) => !currentValue)}
          type="button"
        >
          <EyeIcon isVisible={isVisible} />
        </button>
      }
      type={isVisible ? 'text' : 'password'}
    />
  );
}
