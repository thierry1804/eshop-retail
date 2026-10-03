import React from 'react';
import { Search } from 'lucide-react';

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Classes sur le wrapper (ex. flex-1) */
  className?: string;
  /** Classes sur l’input (ex. text-xs py-1.5) */
  inputClassName?: string;
  id?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  required?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
}

/**
 * Champ de recherche standard Daylight Ledger.
 * Icône Search + app-input, même gabarit partout.
 */
export const SearchField: React.FC<SearchFieldProps> = ({
  value,
  onChange,
  placeholder,
  className = '',
  inputClassName = '',
  id,
  autoFocus,
  disabled,
  required,
  inputRef,
  onFocus,
  onKeyDown
}) => (
  <div className={`relative min-w-0 flex-1 ${className}`}>
    <Search
      className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
      style={{ color: 'var(--app-ink-muted)' }}
      aria-hidden
    />
    <input
      ref={inputRef}
      id={id}
      type="search"
      value={value}
      disabled={disabled}
      required={required}
      autoFocus={autoFocus}
      placeholder={placeholder}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      onChange={(e) => onChange(e.target.value)}
      className={`app-input pl-9 ${inputClassName}`}
    />
  </div>
);
