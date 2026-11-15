import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.href = '/library';
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center min-h-[70vh] p-6 text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">
            {this.props.fallbackTitle || 'Something went wrong loading this view'}
          </h2>
          <p className="text-xs text-muted-foreground leading-relaxed mb-4 max-w-md">
            An unexpected error occurred while rendering the notebook content. Your data in SQLite remains safe.
          </p>

          {this.state.error && (
            <div className="w-full text-left p-3 rounded-lg bg-muted/60 border border-border/60 text-[11px] font-mono text-destructive/90 overflow-x-auto mb-6 max-h-36">
              {this.state.error.message}
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={this.handleReset}
              className="gap-1.5 text-xs h-8"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Library</span>
            </Button>
            <Button
              size="sm"
              onClick={() => window.location.reload()}
              className="gap-1.5 text-xs h-8"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reload Page</span>
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

