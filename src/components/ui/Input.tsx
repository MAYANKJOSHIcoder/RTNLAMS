import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils/helpers';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  requiredIndicator?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function Input({ label, error, requiredIndicator, leftIcon, rightIcon, className, id, ...props }: InputProps) {
  const inputId = id ?? `input-${label?.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700 mb-1">
          {label} {requiredIndicator && <span className="text-red-600" aria-hidden>*</span>}
        </label>
      )}
      <div className="relative">
        {leftIcon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{leftIcon}</span>}
        <input
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={cn(
            'w-full h-11 px-3 border rounded-md text-sm bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0369A1] focus:border-[#0369A1] disabled:opacity-50 disabled:cursor-not-allowed',
            leftIcon ? 'pl-9' : '',
            rightIcon ? 'pr-9' : '',
            error ? 'border-red-500 focus:ring-red-500' : 'border-slate-300',
            className,
          )}
          {...props}
        />
        {rightIcon && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{rightIcon}</span>}
      </div>
      {error && (
        <p id={`${inputId}-error`} role="alert" className="text-xs text-red-600 mt-1">
          {error}
        </p>
      )}
    </div>
  );
}

export default Input;
