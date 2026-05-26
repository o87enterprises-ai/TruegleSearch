import React from 'react';

/**
 * ErrorBoundary - Catches errors in child components and renders fallback
 * Critical for preventing animation crashes from breaking the entire page
 *
 * STABILITY FEATURES:
 * - Catches render errors and prevents full page crashes
 * - Provides reset mechanism via key prop or resetError method
 * - Logs errors for debugging
 * - Renders fallback UI or gracefully degrades
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
    this.resetError = this.resetError.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught an error:', error);
    console.error('Component stack:', errorInfo?.componentStack);

    // Call optional onError callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  // Reset error state - can be called externally via ref
  resetError() {
    this.setState({ hasError: false, error: null, errorInfo: null });
  }

  // Reset when resetKey prop changes (useful for re-attempting render)
  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.resetError();
    }
  }

  render() {
    if (this.state.hasError) {
      // Render custom fallback if provided
      if (this.props.fallback) {
        // If fallback is a function, pass error info and reset handler
        if (typeof this.props.fallback === 'function') {
          return this.props.fallback({
            error: this.state.error,
            errorInfo: this.state.errorInfo,
            resetError: this.resetError,
          });
        }
        return this.props.fallback;
      }

      // Default fallback: simple text that won't crash
      return (
        <span
          style={{
            display: 'inline-block',
            color: 'inherit',
            opacity: 0.8,
          }}
        >
          {this.props.fallbackText ||
            this.props.children?.props?.children ||
            'Content unavailable'}
        </span>
      );
    }

    return this.props.children;
  }
}

/**
 * AnimationErrorBoundary - Specialized error boundary for animation components
 * Renders static version of content if animation fails
 */
export class AnimationErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.warn(
      'Animation failed, falling back to static content:',
      error.message
    );
  }

  render() {
    if (this.state.hasError) {
      // Render static fallback without animation
      return this.props.staticFallback || this.props.children;
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
