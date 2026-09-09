import { Spinner } from './Spinner';

export function LoadingScreen({ message = 'Loading system…' }: { message?: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-black">
      <Spinner size="lg" />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-[#0c0c0c] animate-pulse">
      <div className="h-10 bg-slate-100 border-b" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 border-b border-slate-100 flex items-center gap-3 px-4">
          <div className="h-3 bg-slate-200 rounded w-1/4" />
          <div className="h-3 bg-slate-100 rounded w-1/3" />
          <div className="h-3 bg-slate-100 rounded w-16 ml-auto" />
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return <div className="h-24 bg-slate-100 rounded-xl animate-pulse border border-slate-200" />;
}

export default LoadingScreen;
