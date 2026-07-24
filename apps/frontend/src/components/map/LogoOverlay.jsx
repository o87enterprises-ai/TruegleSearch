import React from 'react';
import './LogoOverlay.css';

// Import the image using Vite's asset handling
import logo from '../../assets/images/truegle.webp';

const LogoOverlay = () => {
  return (
    <div className="logo-overlay">
      <img 
        src={logo} 
        alt="Truegle Logo" 
        className="logo-overlay-image"
      />
    </div>
  );
};

export default LogoOverlay;
