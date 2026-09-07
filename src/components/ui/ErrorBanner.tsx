import { AlertTriangle } from 'lucide-react';

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div role="alert" className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
      <AlertTriangle size={16} className="shrink-0" />
      <span>{message}</span>
    </div>
  );
}
