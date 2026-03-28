export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function Button({
  className,
  type = 'button',
  variant = 'primary',
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={['button', `button-${variant}`, className].filter(Boolean).join(' ')}
    />
  );
}

