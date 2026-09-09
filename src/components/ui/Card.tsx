import type { ReactNode } from 'react';
import { cn } from '../../lib/utils/helpers';

export interface CardProps {
  className?: string;
  hover?: boolean;
  children: ReactNode;
}

export function Card({ className, hover = false, children }: CardProps) {
  return (
    <div className={cn('bg-[#0c0c0c] border border-slate-200 rounded-xl shadow-sm', hover && 'hover:shadow-md transition-shadow cursor-pointer', className)}>
      {children}
    </div>
  );
}

export function CardHeader({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('px-5 py-4 border-b border-slate-100', className)}>{children}</div>;
}

export function CardTitle({ className, children }: { className?: string; children: ReactNode }) {
  return <h3 className={cn('text-sm font-semibold text-slate-900', className)}>{children}</h3>;
}

export function CardContent({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('px-5 py-4', className)}>{children}</div>;
}

export function CardFooter({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('px-5 py-3 border-t border-slate-100 bg-slate-50 rounded-b-xl', className)}>{children}</div>;
}

export default Card;
