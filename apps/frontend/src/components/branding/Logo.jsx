import React from 'react';
import truegleLogo from '../../assets/images/truegle.png';

const Logo = ({ size = 'md', className = '' }) => {
  const sizes = {
    sm: 'h-8 md:h-10',
    md: 'h-12 md:h-14',
    lg: 'h-16 md:h-20',
  };

  return (
    <img
      src={truegleLogo}
      alt="Truegle"
      className={`${sizes[size]} w-auto object-contain ${className}`}
    />
  );
};

export default Logo;
