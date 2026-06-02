import { useId, useState } from 'react';

type StarRatingFieldProps = {
  label: string;
  hint?: string;
  error?: string | null;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function StarRatingField({
  label,
  hint,
  error,
  value,
  onChange,
  disabled,
}: StarRatingFieldProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const numericValue = parseInt(value, 10) || 0;
  const inputId = useId();

  const defaultTitles: Record<number, string> = {
    1: 'Pésimo',
    2: 'Malo',
    3: 'Regular',
    4: 'Bueno',
    5: 'Excelente',
  };

  const currentDisplayValue = hoverValue !== null ? hoverValue : numericValue;
  const activeTitle = currentDisplayValue > 0 ? defaultTitles[currentDisplayValue] : '';

  return (
    <div className="field" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <label className="field-label" id={inputId} style={{ display: 'none' }}>
        {label}
      </label>
      <div 
        role="radiogroup"  
        aria-labelledby={inputId}
        style={{ display: 'flex', gap: '0.25rem', padding: '0.25rem 0' }}
        onMouseLeave={() => setHoverValue(null)}
      >
        {[1, 2, 3, 4, 5].map((star) => {
          return (
            <button
              key={star}
              type="button"
              disabled={disabled}
              onClick={() => onChange(star.toString())}
              onMouseEnter={() => setHoverValue(star)}
              aria-label={`Calificar con ${star} estrellas`}
              aria-checked={numericValue === star}
              role="radio"
              title={defaultTitles[star]}
              style={{
                background: 'none',
                border: 'none',
                cursor: disabled ? 'not-allowed' : 'pointer',
                padding: '0.2rem',
                color: (hoverValue !== null ? star <= hoverValue : star <= numericValue) ? '#f59e0b' : '#cbd5e1',
                transition: 'color 0.2s',
                display: 'inline-flex',
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill={(hoverValue !== null ? star <= hoverValue : star <= numericValue) ? 'currentColor' : 'none'}
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </button>
          );
        })}
      </div>
      
      {/* Dynamic text label */}
      <div style={{ height: '1.5rem', marginTop: '0.2rem', textAlign: 'center' }}>
        <span style={{ 
          color: activeTitle ? '#f59e0b' : 'transparent',
          fontWeight: 800,
          fontSize: '0.9rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          transition: 'all 0.2s ease',
          opacity: activeTitle ? 1 : 0,
          transform: activeTitle ? 'translateY(0)' : 'translateY(-5px)',
          display: 'inline-block'
        }}>
          {activeTitle || 'Empty'}
        </span>
      </div>

      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}
