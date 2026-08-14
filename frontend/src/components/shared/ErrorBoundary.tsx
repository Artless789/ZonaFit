import React, { Component, ErrorInfo } from 'react';
import { ErrorState } from './ErrorState';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full min-h-[400px] flex items-center justify-center p-4">
          <ErrorState 
            title="Algo salió mal."
            description="Estamos teniendo un problema al mostrar esta sección."
            onRetry={this.handleRetry}
            className="w-full max-w-md"
          />
        </div>
      );
    }

    return this.props.children;
  }
}
