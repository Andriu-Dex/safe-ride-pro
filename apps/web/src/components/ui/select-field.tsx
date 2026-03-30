import { useId } from 'react';

type SelectFieldProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
};

export function SelectField({ label, hint, error, children, ...props }: SelectFieldProps) {
  const selectId = useId();

  return (
    <div className="field">
      <label className="field-label" htmlFor={selectId}>
        {label}
      </label>
      <select
        {...props}
        aria-invalid={error ? 'true' : 'false'}
        className={['input', error ? 'input-invalid' : null].filter(Boolean).join(' ')}
        id={selectId}
      >
        {children}
      </select>
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

