import React from 'react';
import './LaserFlow.css';

const LaserFlow = ({ color = '#FF79C6', intensity = 0.8, className = '' }) => {
  return (
    <div
      className={`laser-flow ${className}`}
      style={{
        '--laser-color': color,
        '--laser-intensity': intensity,
      }}
    >
      <div className="laser-beam beam-1"></div>
      <div className="laser-beam beam-2"></div>
      <div className="laser-beam beam-3"></div>
    </div>
  );
};

export default LaserFlow;
