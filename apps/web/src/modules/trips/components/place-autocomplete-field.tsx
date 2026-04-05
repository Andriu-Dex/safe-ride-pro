'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { Button } from '../../../components/ui/button';
import {
  buildGeoapifyAutocompleteUrl,
  type GeoapifyPlaceSuggestion,
  mapGeoapifySuggestions,
} from '../lib/geoapify';
import type { PlaceSelection } from '../types/place-selection';

type PlaceAutocompleteFieldProps = {
  label: string;
  placeholder: string;
  hint?: string;
  disabled?: boolean;
  value: string;
  selectedPlace: PlaceSelection | null;
  onValueChange: (value: string) => void;
  onSelect: (place: PlaceSelection) => void;
  onClear: () => void;
};

export function PlaceAutocompleteField({
  label,
  placeholder,
  hint,
  disabled = false,
  value,
  selectedPlace,
  onValueChange,
  onSelect,
  onClear,
}: PlaceAutocompleteFieldProps) {
  const inputId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const skipNextLookupRef = useRef<string | null>(null);
  const manualDismissRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<GeoapifyPlaceSuggestion[]>([]);

  useEffect(() => {
    if (disabled) {
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    const trimmedValue = value.trim();

    if (trimmedValue.length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
      setErrorMessage(null);
      return;
    }

    if (skipNextLookupRef.current === trimmedValue) {
      skipNextLookupRef.current = null;
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
      setErrorMessage(null);
      return;
    }

    const queryAtRequestTime = trimmedValue;
    const abortController = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        setIsLoading(true);

        const response = await fetch(buildGeoapifyAutocompleteUrl(queryAtRequestTime), {
          signal: abortController.signal,
          headers: {
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error('No fue posible consultar lugares en este momento.');
        }

        const payload = (await response.json()) as Parameters<typeof mapGeoapifySuggestions>[0];
        const nextSuggestions = mapGeoapifySuggestions(payload);

        if (abortController.signal.aborted) {
          return;
        }

        setSuggestions(nextSuggestions);
        setErrorMessage(null);

        const inputElement = inputRef.current;
        const isStillFocused =
          inputElement !== null && document.activeElement === inputElement;
        const currentValueMatches = inputElement?.value.trim() === queryAtRequestTime;

        if (isStillFocused && currentValueMatches && !manualDismissRef.current) {
          setIsOpen(nextSuggestions.length > 0);
        }
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }

        setSuggestions([]);
        setIsOpen(false);
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'No fue posible consultar lugares en este momento.',
        );
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 280);

    return () => {
      abortController.abort();
      window.clearTimeout(timeoutId);
    };
  }, [disabled, value]);

  useEffect(() => {
    const containerElement = containerRef.current;

    if (!containerElement) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerElement.contains(event.target as Node)) {
        manualDismissRef.current = true;
        setIsOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, []);

  const selectedSummary = useMemo(() => {
    if (!selectedPlace) {
      return null;
    }

    return {
      label: selectedPlace.label,
      address: selectedPlace.address,
    };
  }, [selectedPlace]);

  const handleSuggestionSelect = (place: PlaceSelection) => {
    skipNextLookupRef.current = place.label.trim();
    manualDismissRef.current = true;
    onValueChange(place.label);
    onSelect(place);
    setSuggestions([]);
    setIsOpen(false);
    setErrorMessage(null);
  };

  const handleInputChange = (nextValue: string) => {
    manualDismissRef.current = false;
    onValueChange(nextValue);

    if (!nextValue.trim()) {
      setSuggestions([]);
      setIsOpen(false);
      setErrorMessage(null);
    }
  };

  const handleFocus = () => {
    if (!manualDismissRef.current && suggestions.length > 0) {
      setIsOpen(true);
    }
  };

  return (
    <div
      className={[
        'field',
        'place-autocomplete-field',
        isOpen && suggestions.length ? 'place-autocomplete-field-open' : null,
      ]
        .filter(Boolean)
        .join(' ')}
      ref={containerRef}
    >
      <div className="field-inline-header">
        <label className="field-label" htmlFor={inputId}>
          {label}
        </label>
        {value.trim() ? (
          <Button disabled={disabled} onClick={onClear} type="button" variant="ghost">
            Limpiar
          </Button>
        ) : null}
      </div>

      <div
        className={[
          'place-autocomplete-shell',
          disabled ? 'place-autocomplete-shell-disabled' : null,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <input
          className="place-autocomplete-input"
          disabled={disabled}
          id={inputId}
          onChange={(event) => handleInputChange(event.target.value)}
          onFocus={handleFocus}
          placeholder={placeholder}
          ref={inputRef}
          value={value}
        />
      </div>

      {isOpen && suggestions.length ? (
        <div className="place-autocomplete-results" role="listbox">
          {suggestions.map((suggestion) => (
            <button
              className="place-autocomplete-option"
              key={suggestion.id}
              onMouseDown={(event) => {
                event.preventDefault();
                handleSuggestionSelect(suggestion);
              }}
              type="button"
            >
              <strong>{suggestion.label}</strong>
              {suggestion.address ? <span>{suggestion.address}</span> : null}
            </button>
          ))}
        </div>
      ) : null}

      {selectedSummary ? (
        <div className="place-selection-summary">
          <strong>{selectedSummary.label}</strong>
          {selectedSummary.address ? <span>{selectedSummary.address}</span> : null}
        </div>
      ) : null}

      {errorMessage ? (
        <span className="field-error">{errorMessage}</span>
      ) : isLoading ? (
        <span className="field-hint">Buscando lugares...</span>
      ) : hint ? (
        <span className="field-hint">{hint}</span>
      ) : null}
    </div>
  );
}
