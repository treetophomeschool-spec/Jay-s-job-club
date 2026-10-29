import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected application error occurred.',
    };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  override render(): React.ReactNode {
    if (this.state.hasError) {
      let friendlyNote = this.state.errorMessage;
      try {
        const parsed = JSON.parse(this.state.errorMessage);
        if (parsed && typeof parsed.error === 'string') {
          friendlyNote = `${parsed.error} (${parsed.operationType || 'operation'} on ${parsed.path || 'Firestore'})`;
        }
      } catch {
        // Keep plain error text
      }

      return (
        <div className="min-h-screen w-full pointer-events-none select-none flex items-center justify-center bg-[#0F1713] p-6 text-[#F7F4EB]">
          <div className="max-w-xl w-full bg-[#15211A] border border-[#F7F4EB]/20 rounded-xl p-8 text-center space-y-3">
            <h1 className="font-display text-3xl font-bold text-[#F7F4EB]">
              Workshop Notice
            </h1>
            <p className="text-base text-[#D6E0D9] leading-relaxed break-words">
              {friendlyNote}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
