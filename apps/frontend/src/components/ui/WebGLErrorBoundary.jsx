import React from 'react';

class WebGLErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      maxRetries: 3,
      errorType: null,
    };
    // Bind methods
    this.categorizeError = this.categorizeError.bind(this);
    this.handleWebGLError = this.handleWebGLError.bind(this);
    this.forceContextRecycle = this.forceContextRecycle.bind(this);
    this.reduceMemoryUsage = this.reduceMemoryUsage.bind(this);
    this.attemptContextRecovery = this.attemptContextRecovery.bind(this);
    this.retryRendererInit = this.retryRendererInit.bind(this);
    this.useFallbackShader = this.useFallbackShader.bind(this);
    this.showFallbackUI = this.showFallbackUI.bind(this);
    this.retry = this.retry.bind(this);
    this.getErrorIcon = this.getErrorIcon.bind(this);
    this.getErrorMessage = this.getErrorMessage.bind(this);
  }

  static getDerivedStateFromError(error) {
    // Note: Can't call instance methods from static method
    // Error type will be set in componentDidCatch
    return {
      hasError: true,
      error,
      errorType: null,
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error('WebGL Error:', error);
    console.error('Component Stack:', errorInfo.componentStack);

    this.setState({
      error,
      errorInfo,
      errorType: this.categorizeError(error),
    });

    // NO ANALYTICS CALL HERE. This used to fire window.analytics.track(...)
    // with the component name and error text. Nothing sets window.analytics —
    // utils/analytics.js is Cloudflare Web Analytics and exposes no such
    // object — so it never ran, but it is exactly the shape of the per-user
    // event tracking this project does not do. The console already carries
    // everything above for anyone debugging.

    // Attempt recovery based on error type
    this.handleWebGLError(error);
  }

  categorizeError(error) {
    const message = error.message?.toLowerCase() || '';

    if (message.includes('webgl') && message.includes('context')) {
      return 'CONTEXT_ERROR';
    } else if (message.includes('too many') && message.includes('webgl')) {
      return 'CONTEXT_LIMIT';
    } else if (message.includes('out of memory')) {
      return 'MEMORY_ERROR';
    } else if (message.includes('renderer') && message.includes('null')) {
      return 'RENDERER_ERROR';
    } else if (message.includes('shader') || message.includes('compile')) {
      return 'SHADER_ERROR';
    } else if (
      message.includes('texture') ||
      message.includes('max_texture_size')
    ) {
      return 'TEXTURE_ERROR';
    } else {
      return 'UNKNOWN_ERROR';
    }
  }

  handleWebGLError(error) {
    const { errorType } = this.state;

    switch (errorType) {
      case 'CONTEXT_LIMIT':
        console.warn(
          '🔄 WebGL context limit reached, attempting to recycle contexts...'
        );
        this.forceContextRecycle();
        break;

      case 'MEMORY_ERROR':
        console.warn('🧹 WebGL memory pressure detected, reducing quality...');
        this.reduceMemoryUsage();
        break;

      case 'CONTEXT_ERROR':
        console.warn('🔄 WebGL context lost, attempting recovery...');
        this.attemptContextRecovery();
        break;

      case 'RENDERER_ERROR':
        console.warn('🔧 Renderer initialization failed, retrying...');
        this.retryRendererInit();
        break;

      case 'SHADER_ERROR':
        console.warn('⚡ Shader compilation failed, using fallback...');
        this.useFallbackShader();
        break;

      default:
        console.warn('❓ Unknown WebGL error, showing fallback UI...');
        this.showFallbackUI();
        break;
    }
  }

  forceContextRecycle() {
    window.dispatchEvent(
      new CustomEvent('webglContextOverflow', {
        detail: {
          action: 'recycle',
          timestamp: Date.now(),
        },
      })
    );
  }

  reduceMemoryUsage() {
    window.dispatchEvent(
      new CustomEvent('webglMemoryPressure', {
        detail: {
          action: 'reduce_quality',
          timestamp: Date.now(),
        },
      })
    );
  }

  attemptContextRecovery() {
    window.dispatchEvent(
      new CustomEvent('webglContextLost', {
        detail: {
          action: 'recover',
          timestamp: Date.now(),
        },
      })
    );
  }

  retryRendererInit() {
    window.dispatchEvent(
      new CustomEvent('webglRendererError', {
        detail: {
          action: 'retry',
          timestamp: Date.now(),
        },
      })
    );
  }

  useFallbackShader() {
    window.dispatchEvent(
      new CustomEvent('webglShaderError', {
        detail: {
          action: 'fallback',
          timestamp: Date.now(),
        },
      })
    );
  }

  showFallbackUI() {
    window.dispatchEvent(
      new CustomEvent('webglFallback', {
        detail: {
          action: 'show_fallback',
          timestamp: Date.now(),
        },
      })
    );
  }

  retry() {
    if (this.state.retryCount < this.state.maxRetries) {
      this.setState((prev) => ({
        hasError: false,
        error: null,
        errorInfo: null,
        errorType: null,
        retryCount: prev.retryCount + 1,
      }));
    }
  }

  getErrorIcon() {
    const { errorType } = this.state;

    const icons = {
      CONTEXT_LIMIT: '⚠️',
      MEMORY_ERROR: '🧹',
      CONTEXT_ERROR: '🔄',
      RENDERER_ERROR: '🔧',
      SHADER_ERROR: '⚡',
      UNKNOWN_ERROR: '❓',
    };

    return icons[errorType] || '❌';
  }

  getErrorMessage() {
    const { errorType } = this.state;

    const messages = {
      CONTEXT_LIMIT: 'Too many graphics effects active',
      MEMORY_ERROR: 'Graphics memory overloaded',
      CONTEXT_ERROR: 'Graphics context lost',
      RENDERER_ERROR: 'Renderer initialization failed',
      SHADER_ERROR: 'Shader compilation error',
      UNKNOWN_ERROR: 'Graphics error occurred',
    };

    const baseMessage = messages[errorType] || 'Unknown error occurred';
    const retryMessage =
      this.state.retryCount < this.state.maxRetries
        ? ` (${this.state.maxRetries - this.state.retryCount} retries left)`
        : ' (Maximum retries reached)';

    return `${baseMessage}${retryMessage}`;
  }

  render() {
    if (this.state.hasError) {
      const { fallback, showRetry = true, className = '' } = this.props;

      return (
        <div className={`webgl-error-fallback ${className}`}>
          <div className="webgl-error-content">
            <div className="webgl-error-icon">{this.getErrorIcon()}</div>

            <div className="webgl-error-message">
              <p className="webgl-error-title">
                Graphics temporarily unavailable
              </p>
              <p className="webgl-error-description">
                {this.getErrorMessage()}
              </p>

              {showRetry && this.state.retryCount < this.state.maxRetries && (
                <button className="webgl-retry-button" onClick={this.retry}>
                  Retry
                </button>
              )}
            </div>

            {fallback && (
              <div className="webgl-error-fallback-content">{fallback}</div>
            )}
          </div>

          <style jsx>{`
            .webgl-error-fallback {
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 200px;
              background: rgba(0, 0, 0, 0.8);
              border: 1px solid rgba(139, 92, 246, 0.3);
              border-radius: 8px;
              color: white;
              font-family: var(--ds-font-family-sans),
                system-ui,
                -apple-system,
                sans-serif;
            }

            .webgl-error-content {
              text-align: center;
              padding: var(--ds-space-2-5);
              max-width: 400px;
            }

            .webgl-error-icon {
              font-size: var(--ds-font-size-h1);
              line-height: var(--ds-line-height-h1);
              font-weight: var(--ds-font-weight-extrabold);
              margin-bottom: var(--ds-space-2);
            }

            .webgl-error-message {
              margin-bottom: var(--ds-space-2);
            }

            .webgl-error-title {
              font-size: var(--ds-font-size-h3);
              line-height: var(--ds-line-height-h3);
              font-weight: var(--ds-font-weight-semibold);
              margin-bottom: var(--ds-space-1);
              color: var(--ds-text-primary);
            }

            .webgl-error-description {
              font-size: var(--ds-font-size-body-default);
              line-height: var(--ds-line-height-body-default);
              font-weight: var(--ds-font-weight-body-default);
              color: var(--ds-text-secondary);
              margin-bottom: var(--ds-space-2);
            }

            .webgl-retry-button {
              background: linear-gradient(135deg, #8b5cf6, #ec4899);
              border: none;
              color: var(--ds-text-on-brand);
              padding: var(--ds-space-1-5) var(--ds-space-3);
              border-radius: var(--ds-radius-default);
              font-size: var(--ds-font-size-body-default);
              line-height: var(--ds-line-height-body-default);
              font-weight: var(--ds-font-weight-semibold);
              cursor: pointer;
              transition: all 0.2s ease;
            }

            .webgl-retry-button:hover {
              transform: translateY(-2px);
              box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
            }

            .webgl-error-fallback-content {
              margin-top: var(--ds-space-2-5);
              padding-top: var(--ds-space-2-5);
              border-top: 1px solid var(--ds-border-subtle);
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}

export default WebGLErrorBoundary;
