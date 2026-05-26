import './GlitchText.css';

const GlitchText = ({ children, speed = 1, enableShadows = true, enableOnHover = true, className = '', textColor = '#ffffff', glitchColors = ['#ef4444', '#22c55e', '#a855f7'] }) => {
  const inlineStyles = {
    '--after-duration': `${speed * 3}s`,
    '--before-duration': `${speed * 2}s`,
    '--after-shadow': enableShadows ? `-5px 0 ${glitchColors[0]}` : 'none', // red
    '--before-shadow': enableShadows ? `5px 0 ${glitchColors[2]}` : 'none', // purple
    '--text-color': textColor
  };

  const hoverClass = enableOnHover ? 'enable-on-hover' : '';

  return (
    <div
      className={`glitch ${hoverClass} ${className}`}
      style={{...inlineStyles, color: `var(--text-color)`}}
      data-text={children}
    >
      {children}
    </div>
  );
};

export default GlitchText;