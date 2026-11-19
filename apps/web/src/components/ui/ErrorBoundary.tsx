import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw, RefreshCw } from 'lucide-react'

interface ErrorBoundaryProps {
  children: ReactNode
  scope?: string
  resetKey?: string | number
  onRetry?: () => void
  onResetData?: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
  errorMessage: string
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'An unexpected rendering error occurred.',
    }
  }

  public componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env?.DEV) {
      console.error(`[ErrorBoundary:${this.props.scope || 'App'}]`, error, info.componentStack)
    }
  }

  public componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, errorMessage: '' })
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, errorMessage: '' })
    this.props.onRetry?.()
  }

  private handleResetData = () => {
    this.props.onResetData?.()
    this.setState({ hasError: false, errorMessage: '' })
  }

  public render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <div
        role="alert"
        className="mx-auto my-8 max-w-lg rounded-xl border border-rose-200 bg-white p-6 shadow-lg dark:border-rose-900/60 dark:bg-slate-900"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              {this.props.scope ? `${this.props.scope} encountered an error` : 'Something went wrong'}
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {this.state.errorMessage}
            </p>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={this.handleRetry}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </button>
              {this.props.onResetData && (
                <button
                  type="button"
                  onClick={this.handleResetData}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset local data
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }
}
