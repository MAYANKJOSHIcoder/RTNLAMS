import { cn } from '../../lib/utils/helpers';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  label?: string;
}

const sizes = { sm: 'w-4 h-4 border-2', md: 'w-6 h-6 border-2', lg: 'w-8 h-8 border-[3px]' } as const;

export function Spinner({ size = 'md', className, label = 'Loading' }: SpinnerProps) {
  return (
    <span role="status" aria-label={label} className={cn('inline-flex items-center justify-center', className)}>
      <span className={cn('border-slate-300 border-t-white rounded-full animate-spin', sizes[size])} aria-hidden />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function LoadingScreen({ message = 'Loading…' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <Spinner size="lg" />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}

export default Spinner;
