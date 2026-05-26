import React from 'react';

const Logo = ({ size = 'md', className = '' }) => {
  const sizes = {
    sm: 'text-2xl md:text-3xl',
    md: 'text-4xl md:text-5xl',
    lg: 'text-5xl md:text-7xl',
  };

  const letters = [
    { char: 'T', color: 'text-brand-red' },
    { char: 'r', color: 'text-brand-green' },
    { char: 'u', color: 'text-brand-blue' },
    { char: 'e', color: 'text-cyan-400' },
    { char: 'g', color: 'text-brand-yellow' },
    { char: 'l', color: 'text-brand-green' },
    { char: 'e', color: 'text-brand-orange' },
  ];

  return (
    <h1 className={`font-logo font-bold ${sizes[size]} ${className}`}>
      {letters.map((letter, index) => (
        <span key={index} className={letter.color}>
          {letter.char}
        </span>
      ))}
    </h1>
  );
};

export default Logo;
