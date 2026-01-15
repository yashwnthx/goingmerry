import React from 'react';
import { RefreshCw, AlertCircle } from 'lucide-react';

interface ErrorBoundaryState {
    hasError: boolean;
    error?: Error;
}

interface ErrorBoundaryProps {
    children: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        // Log error to monitoring service in production
        console.error('Error caught by boundary:', error, errorInfo);
    }

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center px-6 bg-background">
                    <div className="text-center max-w-md">
                        <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mx-auto mb-6">
                            <AlertCircle size={20} className="text-muted-foreground" />
                        </div>
                        <h1 className="text-[1.25rem] tracking-[-0.02em] mb-2">
                            Something went wrong
                        </h1>
                        <p className="text-[14px] text-muted-foreground mb-6">
                            We encountered an unexpected error. Please try reloading the page.
                        </p>
                        <button
                            onClick={this.handleReload}
                            className="inline-flex items-center gap-2 px-5 h-10 bg-foreground text-background text-[14px] rounded-full hover:opacity-90 transition-all"
                        >
                            <RefreshCw size={14} />
                            Reload page
                        </button>
                        {import.meta.env.DEV && this.state.error && (
                            <pre className="mt-8 p-4 bg-secondary rounded-xl text-left text-2xs text-muted-foreground overflow-auto max-h-48">
                                {this.state.error.message}
                                {'\n\n'}
                                {this.state.error.stack}
                            </pre>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
