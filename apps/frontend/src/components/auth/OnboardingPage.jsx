import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useRewards } from '../../context/RewardsContext';
import authService from '../../services/authService';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';

const { FiTarget, FiTrendingUp, FiUsers, FiShield, FiCheck, FiArrowRight, FiDollarSign } =
  FiIcons;

const OnboardingPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, updateUser } = useAuth();

  // Check if there's a redirect URL after onboarding completion
  // Use the redirectTo from state (passed by ProtectedRoute) or fallback to search results
  const redirectTo = location.state?.redirectTo || '/search-results';

  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [onboardingData, setOnboardingData] = useState({
    interests: [],
    biasPreference: 'all',
    privacyLevel: 'balanced',
    notifications: true,
  });

  useEffect(() => {
    if (!isAuthenticated || !user) {
      navigate('/auth/login');
    }
  }, [isAuthenticated, user, navigate]);

  const onboardingSteps = [
    {
      id: 'interests',
      icon: FiTarget,
      title: 'Choose Your Interests',
      description: 'Select topics you want to stay informed about',
      component: InterestsStep,
    },
    {
      id: 'bias',
      icon: FiUsers,
      title: 'Bias Preferences',
      description: 'How would you like to see different perspectives?',
      component: BiasStep,
    },
    {
      id: 'privacy',
      icon: FiShield,
      title: 'Privacy Settings',
      description: 'Configure your privacy and data preferences',
      component: PrivacyStep,
    },
    {
      id: 'rewards',
      icon: FiDollarSign,
      title: 'Earn Cash Rewards',
      description: 'Get paid for ads you genuinely view',
      component: RewardsStep,
    },
    {
      id: 'complete',
      icon: FiCheck,
      title: 'All Set!',
      description: 'Your personalized search experience is ready',
      component: CompleteStep,
    },
  ];

  const handleNext = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      const result = await authService.completeOnboarding(
        user.userId,
        onboardingData
      );

      if (result.success) {
        updateUser(result.user);
        // Navigate to the redirect URL after onboarding completion
        navigate(redirectTo);
      } else {
        console.error('Failed to complete onboarding:', result.error);
      }
    } catch (error) {
      console.error('Onboarding error:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateOnboardingData = (key, value) => {
    setOnboardingData((prev) => ({ ...prev, [key]: value }));
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const CurrentStepComponent = onboardingSteps[currentStep].component;

  return (
    <div className="min-h-screen flex">
      {/* Left Section - Progress & Info */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-green-600 via-blue-600 to-purple-700 relative overflow-hidden">
        <div className="absolute inset-0 bg-black bg-opacity-20"></div>
        <div className="relative z-10 flex flex-col justify-center px-12 text-white">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-4">Let's Get Started!</h1>
            <p className="text-xl text-green-100 mb-8">
              We're setting up your personalized search experience
            </p>
          </div>

          <div className="space-y-6">
            {onboardingSteps.map((step, index) => (
              <div
                key={index}
                className={`flex items-center space-x-4 ${index <= currentStep ? 'opacity-100' : 'opacity-50'}`}
              >
                <div
                  className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center backdrop-blur-sm ${
                    index < currentStep
                      ? 'bg-green-500'
                      : index === currentStep
                        ? 'bg-white bg-opacity-20'
                        : 'bg-white bg-opacity-10'
                  }`}
                >
                  <SafeIcon
                    icon={index < currentStep ? FiCheck : step.icon}
                    size={24}
                    className={
                      index < currentStep ? 'text-white' : 'text-white'
                    }
                  />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">
                    {step.title}
                  </h3>
                  <p className="text-green-100 text-sm">{step.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-12 p-6 bg-white bg-opacity-10 rounded-lg backdrop-blur-sm">
            <div className="flex items-center space-x-3 mb-3">
              <SafeIcon icon={FiShield} className="text-green-200" size={20} />
              <h4 className="text-white font-semibold">Your Privacy Matters</h4>
            </div>
            <p className="text-sm text-green-100">
              All information you provide is encrypted and used only to improve
              your search experience. We never sell your data.
            </p>
          </div>
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-20 right-20 w-32 h-32 bg-white bg-opacity-10 rounded-full blur-xl"></div>
        <div className="absolute bottom-20 left-20 w-24 h-24 bg-green-300 bg-opacity-20 rounded-full blur-lg"></div>
      </div>

      {/* Right Section - Onboarding Steps */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="text-center mb-8 lg:hidden">
            <div className="text-4xl font-bold mb-4">
              <span className="text-blue-600">T</span>
              <span className="text-red-500">r</span>
              <span className="text-yellow-500">u</span>
              <span className="text-blue-600">e</span>
              <span className="text-green-500">g</span>
              <span className="text-red-500">l</span>
              <span className="text-purple-600">e</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Let's Get Started!
            </h1>
            <p className="text-gray-600">Personalize your search experience</p>
          </div>

          <div className="bg-white rounded-lg shadow-lg p-8">
            <CurrentStepComponent
              data={onboardingData}
              updateData={updateOnboardingData}
              onNext={handleNext}
              onPrevious={handlePrevious}
              onComplete={handleComplete}
              currentStep={currentStep}
              totalSteps={onboardingSteps.length}
              loading={loading}
            />
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">
              Step {currentStep + 1} of {onboardingSteps.length} • You can
              change these preferences later in settings
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Individual step components
const InterestsStep = ({ data, updateData, onNext }) => {
  const interests = [
    'Politics',
    'Technology',
    'Science',
    'Health',
    'Business',
    'Sports',
    'Entertainment',
    'Environment',
    'Education',
    'Travel',
  ];

  const toggleInterest = (interest) => {
    const currentInterests = data.interests || [];
    const newInterests = currentInterests.includes(interest)
      ? currentInterests.filter((i) => i !== interest)
      : [...currentInterests, interest];
    updateData('interests', newInterests);
  };

  return (
    <div>
      <h3 className="text-xl font-semibold mb-4">What interests you?</h3>
      <p className="text-gray-600 mb-6">
        Select topics to personalize your search results
      </p>

      <div className="grid grid-cols-2 gap-3 mb-8">
        {interests.map((interest) => (
          <button
            key={interest}
            onClick={() => toggleInterest(interest)}
            className={`p-3 rounded-lg border-2 text-sm font-medium transition-colors ${
              (data.interests || []).includes(interest)
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
            }`}
          >
            {interest}
          </button>
        ))}
      </div>

      <button
        onClick={onNext}
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center"
      >
        Continue <SafeIcon icon={FiArrowRight} className="ml-2" size={16} />
      </button>
    </div>
  );
};

const BiasStep = ({ data, updateData, onNext, onPrevious }) => {
  const biasOptions = [
    {
      value: 'all',
      label: 'Show All Perspectives',
      description: 'See results from all political viewpoints',
    },
    {
      value: 'balanced',
      label: 'Balanced View',
      description: 'Prioritize center and unbiased sources',
    },
    {
      value: 'diverse',
      label: 'Diverse Sources',
      description: 'Ensure representation from different viewpoints',
    },
  ];

  return (
    <div>
      <h3 className="text-xl font-semibold mb-4">Bias Preferences</h3>
      <p className="text-gray-600 mb-6">
        How would you like to see different perspectives?
      </p>

      <div className="space-y-3 mb-8">
        {biasOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => updateData('biasPreference', option.value)}
            className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${
              data.biasPreference === option.value
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="font-medium text-gray-900">{option.label}</div>
            <div className="text-sm text-gray-600 mt-1">
              {option.description}
            </div>
          </button>
        ))}
      </div>

      <div className="flex space-x-3">
        <button
          onClick={onPrevious}
          className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center"
        >
          Continue <SafeIcon icon={FiArrowRight} className="ml-2" size={16} />
        </button>
      </div>
    </div>
  );
};

const PrivacyStep = ({ data, updateData, onNext, onPrevious }) => {
  const privacyOptions = [
    {
      value: 'minimal',
      label: 'Minimal Data',
      description: 'Only essential data for functionality',
    },
    {
      value: 'balanced',
      label: 'Balanced',
      description: 'Some personalization with privacy protection',
    },
    {
      value: 'personalized',
      label: 'Full Personalization',
      description: 'Maximum personalization features',
    },
  ];

  return (
    <div>
      <h3 className="text-xl font-semibold mb-4">Privacy Settings</h3>
      <p className="text-gray-600 mb-6">Choose your privacy level</p>

      <div className="space-y-3 mb-6">
        {privacyOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => updateData('privacyLevel', option.value)}
            className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${
              data.privacyLevel === option.value
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="font-medium text-gray-900">{option.label}</div>
            <div className="text-sm text-gray-600 mt-1">
              {option.description}
            </div>
          </button>
        ))}
      </div>

      <div className="mb-8">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={data.notifications}
            onChange={(e) => updateData('notifications', e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="ml-3 text-sm text-gray-700">
            Receive notifications about important news updates
          </span>
        </label>
      </div>

      <div className="flex space-x-3">
        <button
          onClick={onPrevious}
          className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center"
        >
          Continue <SafeIcon icon={FiArrowRight} className="ml-2" size={16} />
        </button>
      </div>
    </div>
  );
};

const RewardsStep = ({ onNext, onPrevious }) => {
  const { optedIn, optIn, optOut, loading } = useRewards();

  const handleToggle = async () => {
    if (optedIn) {
      await optOut();
    } else {
      await optIn();
    }
  };

  return (
    <div>
      <h3 className="text-xl font-semibold mb-4">Earn Cash for Ads You View</h3>
      <p className="text-gray-600 mb-6">
        Opt in and we'll pay you a small cash reward for ads you genuinely view while waiting on
        search results — honestly measured server-side, nothing simulated. You can change this
        anytime in Settings.
      </p>

      <button
        onClick={handleToggle}
        disabled={loading}
        className={`w-full p-4 rounded-lg border-2 text-left transition-colors mb-8 flex items-center justify-between disabled:opacity-50 ${
          optedIn ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white hover:border-gray-300'
        }`}
      >
        <div>
          <div className="font-medium text-gray-900">
            {optedIn ? "You're opted in" : 'Opt in to Rewards'}
          </div>
          <div className="text-sm text-gray-600 mt-1">
            {optedIn
              ? 'You will earn rewards for honestly-viewed ads.'
              : 'Tap to start earning while you search.'}
          </div>
        </div>
        <div
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
            optedIn ? 'bg-green-600' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition-transform ${
              optedIn ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </div>
      </button>

      <div className="flex space-x-3">
        <button
          onClick={onPrevious}
          className="flex-1 border border-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={onNext}
          className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center"
        >
          Continue <SafeIcon icon={FiArrowRight} className="ml-2" size={16} />
        </button>
      </div>
    </div>
  );
};

const CompleteStep = ({ onComplete, loading }) => {
  return (
    <div className="text-center">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <SafeIcon icon={FiCheck} size={32} className="text-green-600" />
      </div>

      <h3 className="text-xl font-semibold mb-4">You're All Set!</h3>
      <p className="text-gray-600 mb-8">
        Your personalized search experience is ready. Start exploring unbiased
        information tailored to your preferences.
      </p>

      <button
        onClick={onComplete}
        disabled={loading}
        className="w-full bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
      >
        {loading ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
            Setting up...
          </>
        ) : (
          'Start Searching'
        )}
      </button>
    </div>
  );
};

export default OnboardingPage;
