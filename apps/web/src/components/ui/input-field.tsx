import { useId } from 'react';

type InputFieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: string;
  hint?: string;
  error?: string | null;
  inputClassName?: string;
  trailingAction?: React.ReactNode;
};

export function InputField({
  label,
  hint,
  error,
  inputClassName,
  trailingAction,
  ...props
}: InputFieldProps) {
  const inputId = useId();

  return (
    <div className="field">
      <label className="field-label" htmlFor={inputId}>
        {label}
      </label>
      <div className={trailingAction ? 'input-shell input-shell-with-action' : 'input-shell'}>
        <input
          {...props}
          id={inputId}
          aria-invalid={error ? 'true' : 'false'}
          className={['input', error ? 'input-invalid' : null, inputClassName]
            .filter(Boolean)
            .join(' ')}
        />
        {trailingAction ? <span className="input-trailing-action">{trailingAction}</span> : null}
      </div>
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}


