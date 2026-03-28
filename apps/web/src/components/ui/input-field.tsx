import { useId } from 'react';

type InputFieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: string;
  hint?: string;
};

export function InputField({ label, hint, ...props }: InputFieldProps) {
  const inputId = useId();

  return (
    <label className="field" htmlFor={inputId}>
      <span className="field-label">{label}</span>
      <input {...props} id={inputId} className="input" />
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}


