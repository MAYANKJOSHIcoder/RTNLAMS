import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-black text-center">
          <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-3">
            <AlertTriangle size={24} />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Something went wrong</h1>
          <p className="text-sm text-slate-600 mt-2 max-w-md">
            The application encountered an unexpected error. This has been logged. You can try again or reload the page.
          </p>
          {import.meta.env.DEV && this.state.error && (
            <pre className="text-xs text-left bg-[#0c0c0c] text-slate-300 border border-white/10 rounded-lg p-3 mt-4 max-w-2xl overflow-auto w-full">{this.state.error.message}</pre>
          )}
          <div className="flex gap-2 mt-6">
            <Button onClick={this.handleReset} leftIcon={<RefreshCw size={16} />}>
              Try Again
            </Button>
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Reload Page
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
