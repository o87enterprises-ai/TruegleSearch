import React, { Component } from 'react';

class WebGLErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, webGLAvailable: true };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('WebGL Error:', error);
    // Check if error is WebGL related
    if (error.message.includes('WebGL') || error.message.includes('context')) {
      this.setState({ webGLAvailable: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '8px',
            padding: 'var(--ds-space-2-5)', /* 20px */
            margin: 'var(--ds-space-1-5)', /* 12px (closest to 10px) */
            color: 'white',
            textAlign: 'center',
          }}
        >
          <h3>Background Animation Unavailable</h3>
          <p>Using fallback background due to system limitations.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{
              background: 'white',
              color: '#667eea',
              border: 'none',
              padding: 'var(--ds-space-1) var(--ds-space-2)', /* 8px 16px */
              borderRadius: '4px',
              cursor: 'pointer',
              marginTop: 'var(--ds-space-1-5)', /* 12px (closest to 10px) */
            }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default WebGLErrorBoundary;
