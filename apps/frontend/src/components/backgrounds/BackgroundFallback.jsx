// BackgroundFallback.jsx
export default function BackgroundFallback() {
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-900 via-purple-900 to-blue-900 overflow-hidden z-0">
      <div className="absolute inset-0">
        {/* Animated gradient fallback */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 animate-pulse"></div>
        
        {/* Static stars fallback */}
        {[...Array(50)].map((_, i) => (
          <div 
            key={i}
            className="absolute bg-white rounded-full animate-twinkle"
            style={{
              width: `${Math.random() * 2 + 1}px`,
              height: `${Math.random() * 2 + 1}px`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              opacity: Math.random() * 0.7 + 0.3,
            }}
          />
        ))}
      </div>
    </div>
  );
}