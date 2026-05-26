import React from 'react';

const SimpleTest = () => {
  return (
    <div className="w-full h-screen bg-black relative">
      {/* Test centered red box */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-red-500" />

      {/* Test laser background */}
      <div className="absolute inset-0 bg-gradient-to-b from-pink-500 to-transparent opacity-50" />

      {/* Test UI overlay */}
      <div className="absolute inset-0 flex items-center justify-center z-50">
        <div className="text-white text-4xl font-bold">TRUEGLE</div>
      </div>
    </div>
  );
};

export default SimpleTest;
