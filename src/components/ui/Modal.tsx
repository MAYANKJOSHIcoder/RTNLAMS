import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils/helpers';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, actions, className }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        className={cn('relative bg-[#0c0c0c] rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col', className)}
      >
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            <button onClick={onClose} aria-label="Close modal" className="p-1.5 hover:bg-slate-100 rounded-md cursor-pointer">
              <X size={18} />
            </button>
          </div>
        )}
        <div className="px-5 py-4 overflow-auto flex-1">{children}</div>
        {actions && <div className="px-5 py-3 border-t border-slate-200 flex justify-end gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export default Modal;
