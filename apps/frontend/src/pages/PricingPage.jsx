import React from 'react';
import { useNavigate } from 'react-router-dom';
import Logo from '../components/branding/Logo';

const PricingPage = () => {
  const navigate = useNavigate();

  const handleSubscribe = (tier) => {
    alert(
      `Subscribing to ${tier} plan. This will connect to Stripe checkout when backend is fully configured.`
    );
  };

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Background */}
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-purple-900/20 to-black"></div>

      {/* Header */}
      <header className="relative z-10 py-6 px-4 border-b border-white/10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <button onClick={() => navigate('/')} className="cursor-pointer">
            <Logo size="sm" />
          </button>
          <button
            onClick={() => navigate('/search')}
            className="px-4 py-2 rounded-lg font-semibold text-white/80 hover:text-white"
          >
            Back to Search
          </button>
        </div>
      </header>

      {/* Pricing Content */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-white/60">
            Find the perfect plan for your search needs
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8">
          {/* Free Tier */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
            <h3 className="text-2xl font-bold mb-2">Free</h3>
            <div className="text-4xl font-bold mb-4">
              $0<span className="text-xl text-white/60">/month</span>
            </div>
            <ul className="space-y-3 mb-8">
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>50 searches per day</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Basic bias analysis</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>All perspectives available</span>
              </li>
              <li className="flex items-start">
                <span className="text-red-400 mr-2">×</span>
                <span className="text-white/40">Includes ads</span>
              </li>
            </ul>
            <button
              onClick={() => navigate('/search')}
              className="w-full px-6 py-3 rounded-lg font-semibold
                       bg-white/10 hover:bg-white/20 transition-all"
            >
              Get Started
            </button>
          </div>

          {/* Premium Tier */}
          <div className="bg-gradient-to-b from-purple-500/20 to-pink-500/20 backdrop-blur-sm rounded-2xl p-8 border-2 border-purple-500/50 relative">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
              POPULAR
            </div>
            <h3 className="text-2xl font-bold mb-2">Premium</h3>
            <div className="text-4xl font-bold mb-4">
              $9.99<span className="text-xl text-white/60">/month</span>
            </div>
            <ul className="space-y-3 mb-8">
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Unlimited searches</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Ad-free experience</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Advanced analytics</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Export search history</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Priority support</span>
              </li>
            </ul>
            <button
              onClick={() => handleSubscribe('premium')}
              className="w-full px-6 py-3 rounded-lg font-semibold text-white
                       bg-gradient-to-r from-purple-500 to-pink-500
                       hover:scale-105 transition-all shadow-lg"
            >
              Subscribe Now
            </button>
          </div>

          {/* Enterprise Tier */}
          <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
            <h3 className="text-2xl font-bold mb-2">Enterprise</h3>
            <div className="text-4xl font-bold mb-4">
              $29.99<span className="text-xl text-white/60">/month</span>
            </div>
            <ul className="space-y-3 mb-8">
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Everything in Premium</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>API access</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>White-label options</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Custom bias categories</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-400 mr-2">✓</span>
                <span>Dedicated account manager</span>
              </li>
            </ul>
            <button
              onClick={() => handleSubscribe('enterprise')}
              className="w-full px-6 py-3 rounded-lg font-semibold
                       bg-gradient-to-r from-yellow-500 to-orange-500
                       hover:scale-105 transition-all"
            >
              Contact Sales
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PricingPage;
