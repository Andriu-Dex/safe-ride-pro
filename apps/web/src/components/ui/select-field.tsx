type SelectFieldProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
  children: React.ReactNode;
};

export function SelectField({ label, hint, children, ...props }: SelectFieldProps) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <select {...props} className="input">
        {children}
      </select>
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

