import { Link } from 'react-router-dom';

export default function TrailGameLink() {
  return (
    <>
      <style>{`
        @keyframes glow {
          0%, 100% {
            text-shadow: 0 0 5px rgba(168, 85, 247, 0.4),
                         0 0 10px rgba(168, 85, 247, 0.2);
          }
          50% {
            text-shadow: 0 0 15px rgba(168, 85, 247, 0.8),
                         0 0 25px rgba(168, 85, 247, 0.5),
                         0 0 35px rgba(168, 85, 247, 0.3);
          }
        }

        @keyframes sparkle {
          0%, 100% { opacity: 0; }
          50% { opacity: 1; }
        }

        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-3px); }
        }

        .trail-game-link {
          cursor: pointer;
          position: relative;
          display: inline-block;
          will-change: auto;
        }

        .trail-game-link::before,
        .trail-game-link::after {
          content: '✨';
          position: absolute;
          font-size: 0.8em;
          animation: sparkle 1.5s ease-in-out infinite;
          will-change: opacity;
        }

        .trail-game-link::before {
          left: -12px;
          top: -2px;
          animation-delay: 0s;
        }

        .trail-game-link::after {
          right: -12px;
          top: -2px;
          animation-delay: 0.7s;
        }

        /* Only animate on hover to avoid stability issues */
        .trail-game-link:hover {
          animation: glow 1.2s ease-in-out infinite, float 2s ease-in-out infinite;
          will-change: text-shadow, transform;
        }

        /* Default glow without continuous animation */
        .trail-game-link {
          text-shadow: 0 0 5px rgba(168, 85, 247, 0.4),
                       0 0 10px rgba(168, 85, 247, 0.2);
          transition: text-shadow 0.3s ease, transform 0.3s ease;
        }
      `}</style>

      <Link
        to="/this-does-not-exist"
        className="trail-game-link text-body-small text-gray-500 hover:text-purple-300 transition-colors"
      >
        © 2025 Truegle. All rights reserved.
      </Link>
    </>
  );
}
