'use client';

import { useState } from 'react';

type DisclosurePanelProps = {
  title: string;
  meta?: string;
  description?: string;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (nextOpen: boolean) => void;
  className?: string;
  children: React.ReactNode;
};

export function DisclosurePanel({
  title,
  meta,
  description,
  defaultOpen = false,
  open,
  onOpenChange,
  className,
  children,
}: DisclosurePanelProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = typeof open === 'boolean';
  const isOpen = isControlled ? open : internalOpen;

  const toggleOpen = () => {
    const nextOpen = !isOpen;

    if (!isControlled) {
      setInternalOpen(nextOpen);
    }

    onOpenChange?.(nextOpen);
  };

  return (
    <article
      className={[
        'disclosure-panel',
        'panel',
        'panel-stack',
        isOpen ? 'disclosure-panel-open' : null,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        aria-expanded={isOpen}
        className="disclosure-summary"
        onClick={toggleOpen}
        type="button"
      >
        <span className="disclosure-summary-copy">
          <span className="panel-title">{title}</span>
          {description ? <span className="panel-text">{description}</span> : null}
        </span>
        <span className="disclosure-summary-meta">
          {meta ? <span className="section-heading-meta">{meta}</span> : null}
          <span className="disclosure-summary-icon" aria-hidden="true">
            ▾
          </span>
        </span>
      </button>

      {isOpen ? <div className="disclosure-content">{children}</div> : null}
    </article>
  );
}
