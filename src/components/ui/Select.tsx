import type { SelectHTMLAttributes } from 'react';
import { cn } from '../../lib/utils/helpers';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: SelectOption[];
  placeholder?: string;
}

export function Select({ label, error, options, placeholder = 'Select…', className, id, ...props }: SelectProps) {
  const selectId = id ?? `select-${label?.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium text-slate-700 mb-1">
          {label}
        </label>
      )}
      <select
        id={selectId}
        aria-invalid={!!error}
        aria-describedby={error ? `${selectId}-error` : undefined}
        className={cn(
          'w-full h-11 px-3 border rounded-md text-sm bg-[#0c0c0c] focus:outline-none focus:ring-2 focus:ring-[#38bdf8] focus:border-[#38bdf8] cursor-pointer',
          error ? 'border-red-500' : 'border-slate-300',
          className,
        )}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${selectId}-error`} role="alert" className="text-xs text-red-600 mt-1">
          {error}
        </p>
      )}
    </div>
  );
}

export default Select;
