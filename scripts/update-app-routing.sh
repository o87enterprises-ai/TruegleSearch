#!/bin/bash

echo "Updating App.jsx with logo demo route..."

cat > frontend/src/App.jsx << 'APP_END'
import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import SearchPage from './pages/SearchPage';
import FeelingBiasedPage from './pages/FeelingBiasedPage';
import PricingPage from './pages/PricingPage';
import AuthPage from './pages/AuthPage';
import LogoDemo from './pages/LogoDemo';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/feeling-biased" element={<FeelingBiasedPage />} />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/logo-demo" element={<LogoDemo />} />
      </Routes>
    </Router>
  );
}

export default App;
APP_END

echo "✅ App.jsx updated with logo demo route!"
