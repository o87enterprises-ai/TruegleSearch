import React from 'react';

const StandardizedLayoutDemo = () => {
  return (
    <div className="container mx-auto">
      <section className="section">
        <h1 className="text-display-large text-center mb-8">Standardized Layout Demo</h1>
        <p className="text-body-large text-center mb-12">This page demonstrates the new standardized layout classes using the 8px spacing scale.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Standard Card */}
          <div className="card">
            <h3 className="text-headline-small mb-4">Standard Card</h3>
            <p className="text-body-medium">This is a standard card using the new standardized layout classes with consistent spacing.</p>
          </div>
          
          {/* Glass Card */}
          <div className="card-glass">
            <h3 className="text-headline-small mb-4">Glass Card</h3>
            <p className="text-body-medium">This is a glass card using the new standardized layout classes with consistent spacing.</p>
          </div>
          
          {/* Large Card */}
          <div className="card-lg">
            <h3 className="text-headline-small mb-4">Large Card</h3>
            <p className="text-body-medium">This is a large card using the new standardized layout classes with consistent spacing.</p>
          </div>
        </div>
      </section>
      
      <section className="section-sm bg-gray-100">
        <div className="container mx-auto">
          <h2 className="text-headline-large mb-6">Section with Small Padding</h2>
          <p className="text-body-large mb-8">This section uses the section-sm class with reduced vertical padding.</p>
          
          <div className="card-sm">
            <h3 className="text-headline-small mb-3">Small Card</h3>
            <p className="text-body-medium">This is a small card with reduced padding using the card-sm class.</p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default StandardizedLayoutDemo;