type TextareaFieldProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
};

export function TextareaField({ label, hint, ...props }: TextareaFieldProps) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <textarea {...props} className="input textarea" />
      {hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}
