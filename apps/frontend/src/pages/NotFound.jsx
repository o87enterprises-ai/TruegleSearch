import React from 'react';
import { Link } from 'react-router-dom';
import GameboyGame from '../components/GameboyGame';

const NotFound = () => {
  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="container mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-6xl font-bold mb-4 font-mono text-green-400">
            404 - MOON LANDING GAME
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto font-mono">
            PAGE NOT FOUND! BUT YOU FOUND OUR SECRET MOVIE SET GAME.
            AVOID THE OBSTACLES AND REACH DIRECTOR KUBRICK!
          </p>
        </header>
        
        <main className="mb-12">
          <div class="min-h-screen flex items-center justify-center bg-black">
  <GameboyGame />
</div>
        </main>
        
        <div className="text-center space-y-6 max-w-2xl mx-auto">
          <div className="bg-gray-800 p-6 rounded-lg border-2 border-gray-700">
            <h2 className="text-2xl font-bold mb-4 font-mono text-yellow-300">
              GAME INSTRUCTIONS
            </h2>
            <ul className="space-y-2 text-left text-gray-300 font-mono">
              <li className="flex items-center">
                <span className="inline-block w-6 h-6 bg-green-500 mr-3 rounded"></span>
                <span>← → : Move Astronauts</span>
              </li>
              <li className="flex items-center">
                <span className="inline-block w-6 h-6 bg-red-500 mr-3 rounded"></span>
                <span>SPACE : Jump Over Obstacles</span>
              </li>
              <li className="flex items-center">
                <span className="inline-block w-6 h-6 bg-blue-500 mr-3 rounded"></span>
                <span>R : Restart Game</span>
              </li>
              <li className="flex items-center">
                <span className="inline-block w-6 h-6 bg-purple-500 mr-3 rounded"></span>
                <span>ESC : Exit to Website</span>
              </li>
            </ul>
          </div>
          
          <div className="flex flex-col sm:flex-row justify-center gap-4 mt-8">
            <Link 
              to="/"
              className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-colors duration-200 font-mono text-sm"
            >
              🏠 RETURN TO HOME
            </Link>
            <button 
              onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', {key: 'r'}))}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors duration-200 font-mono text-sm"
            >
              🔄 RESTART GAME
            </button>
          </div>
          
          <div className="mt-12 text-gray-400 text-sm font-mono">
            <p>✨ SECRET 404 EASTER EGG ✨</p>
            <p className="mt-2">SCORE OVER 1000 TO SEE SPECIAL ENDING!</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
