import React from 'react';

const SimpleTest = () => {
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        background: 'linear-gradient(45deg, #FF79C6, #00FFFF)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: 'var(--ds-font-size-h3)',
        lineHeight: 'var(--ds-line-height-h3)',
        fontWeight: 'var(--ds-font-weight-semibold)',
      }}
    >
      <h1>🎉 Components Working!</h1>
    </div>
  );
};

export default SimpleTest;
