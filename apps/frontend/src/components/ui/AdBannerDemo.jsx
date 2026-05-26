import React from 'react';
import AdBanner from './AdBanner';

const AdBannerDemo = () => {
  const handleYellowAdClick = () => {
    console.log('Yellow ad clicked');
  };

  const handleBlueAdClick = () => {
    console.log('Blue ad clicked');
  };

  const handleRedAdClick = () => {
    console.log('Red ad clicked');
  };

  const handleEmeraldAdClick = () => {
    console.log('Emerald ad clicked');
  };

  const handleGlassAdClick = () => {
    console.log('Glass ad clicked');
  };

  const handleDismiss = (variant) => {
    console.log(`${variant} ad dismissed`);
  };

  const handleImpression = (variant) => {
    console.log(`${variant} ad impression tracked`);
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold text-white mb-8">AdBanner Component Demo</h1>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-white">Variants</h2>

        <div>
          <h3 className="text-lg font-medium text-gray-300 mb-2">Yellow (Default) - Medium</h3>
          <AdBanner
            variant="yellow"
            size="medium"
            title="AI Research Tools"
            description="Advanced analytics for professionals"
            ctaText="Learn More"
            onClick={handleYellowAdClick}
            onDismiss={() => handleDismiss('yellow')}
            onImpression={() => handleImpression('yellow')}
          />
        </div>

        <div>
          <h3 className="text-lg font-medium text-gray-300 mb-2">Blue - Large</h3>
          <AdBanner
            variant="blue"
            size="large"
            title="Upgrade to Premium"
            description="Get unlimited searches without ads"
            ctaText="Upgrade Now"
            onClick={handleBlueAdClick}
            onDismiss={() => handleDismiss('blue')}
          />
        </div>

        <div>
          <h3 className="text-lg font-medium text-gray-300 mb-2">Red - Small</h3>
          <AdBanner
            variant="red"
            size="small"
            title="Limited Time Offer"
            description="50% off all premium features"
            ctaText="Claim Now"
            onClick={handleRedAdClick}
            onDismiss={() => handleDismiss('red')}
          />
        </div>

        <div>
          <h3 className="text-lg font-medium text-gray-300 mb-2">Emerald - Medium</h3>
          <AdBanner
            variant="emerald"
            size="medium"
            title="Earn Tokens"
            description="Watch ads to earn free search credits"
            ctaText="Watch Ad"
            onClick={handleEmeraldAdClick}
            onDismiss={() => handleDismiss('emerald')}
          />
        </div>

        <div>
          <h3 className="text-lg font-medium text-gray-300 mb-2">Glass - Large</h3>
          <AdBanner
            variant="glass"
            size="large"
            title="Pro Features"
            description="Unlock advanced search capabilities"
            ctaText="Explore"
            onClick={handleGlassAdClick}
            onDismiss={() => handleDismiss('glass')}
          />
        </div>
      </div>

      <div className="space-y-4 mt-8">
        <h2 className="text-xl font-semibold text-white">Auto-dismiss with Progress</h2>

        <div>
          <h3 className="text-lg font-medium text-gray-300 mb-2">Yellow - 5 seconds</h3>
          <AdBanner
            variant="yellow"
            size="medium"
            title="Auto-dismissing Banner"
            description="This will disappear in 5 seconds"
            ctaText="View"
            duration={5000}
            onDismiss={() => handleDismiss('auto-yellow')}
            onImpression={() => handleImpression('auto-yellow')}
          />
        </div>
      </div>

      <div className="space-y-4 mt-8">
        <h2 className="text-xl font-semibold text-white">Non-dismissible</h2>

        <div>
          <h3 className="text-lg font-medium text-gray-300 mb-2">Blue - Cannot dismiss</h3>
          <AdBanner
            variant="blue"
            size="medium"
            title="Important Notice"
            description="This banner cannot be closed"
            ctaText="Read"
            dismissible={false}
            onClick={handleBlueAdClick}
          />
        </div>
      </div>

      <div className="space-y-4 mt-8">
        <h2 className="text-xl font-semibold text-white">No CTA Button</h2>

        <div>
          <h3 className="text-lg font-medium text-gray-300 mb-2">Yellow - Information only</h3>
          <AdBanner
            variant="yellow"
            size="medium"
            title="New Feature Available"
            description="Check out our latest updates"
            onDismiss={() => handleDismiss('info')}
          />
        </div>
      </div>
    </div>
  );
};

export default AdBannerDemo;
