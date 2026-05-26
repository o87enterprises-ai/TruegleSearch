/**
 * Animation Trigger Test Component
 * Tests the Cosmic Search Portal animation triggers for both desktop and mobile
 */

import React, { useState, useEffect, useRef } from 'react';
import { attachTouchGestures, DEFAULT_GESTURE_CONFIG } from '../utils/touchGestures';
import { getAnimationConfig } from '../utils/animationConfig';
import { fallbackController } from '../utils/fallbackAnimations';

const AnimationTriggerTest = () => {
  const [platform, setPlatform] = useState('desktop');
  const [animationState, setAnimationState] = useState('idle'); // idle, initiating, engaging, shifting, maxima, transitioning
  const [testResults, setTestResults] = useState({});
  const [isTouchSupported, setIsTouchSupported] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  
  const testContainerRef = useRef(null);
  const touchHandlerRef = useRef(null);

  // Detect platform and accessibility settings
  useEffect(() => {
    const config = getAnimationConfig();
    setPlatform(config.platform);
    
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mediaQuery.matches);
    
    const checkTouchSupport = () => {
      setIsTouchSupported('ontouchstart' in window || navigator.maxTouchPoints > 0);
    };
    
    checkTouchSupport();
    
    // Listen for changes in reduced motion preference
    const handleReducedMotionChange = (e) => {
      setReducedMotion(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleReducedMotionChange);
    
    return () => {
      mediaQuery.removeEventListener('change', handleReducedMotionChange);
    };
  }, []);

  // Setup touch gestures if on mobile
  useEffect(() => {
    if (platform === 'mobile' && testContainerRef.current) {
      touchHandlerRef.current = attachTouchGestures(testContainerRef.current, {
        swipedown: () => handleSwipeDown(),
        tap: () => handleTap(),
        longpress: () => handleLongPress(),
      });
    }
    
    return () => {
      if (touchHandlerRef.current) {
        touchHandlerRef.current.destroy();
      }
    };
  }, [platform]);

  const handleSwipeDown = () => {
    console.log('[AnimationTriggerTest] Swipe down detected');
    triggerAnimationSequence();
    setTestResults(prev => ({
      ...prev,
      swipeDown: { success: true, timestamp: new Date().toISOString() }
    }));
  };

  const handleTap = () => {
    console.log('[AnimationTriggerTest] Tap detected');
    triggerAnimationSequence();
    setTestResults(prev => ({
      ...prev,
      tap: { success: true, timestamp: new Date().toISOString() }
    }));
  };

  const handleLongPress = () => {
    console.log('[AnimationTriggerTest] Long press detected');
    setTestResults(prev => ({
      ...prev,
      longPress: { success: true, timestamp: new Date().toISOString() }
    }));
  };

  const triggerAnimationSequence = () => {
    console.log('[AnimationTriggerTest] Triggering animation sequence');
    
    // Simulate animation phases
    setAnimationState('initiating');
    
    setTimeout(() => {
      setAnimationState('engaging');
    }, 500); // Platform-specific delay
    
    setTimeout(() => {
      setAnimationState('shifting');
    }, 1500); // Platform-specific delay
    
    setTimeout(() => {
      setAnimationState('maxima');
    }, 2500); // Platform-specific delay
    
    setTimeout(() => {
      setAnimationState('transitioning');
    }, 3500); // Platform-specific delay
    
    setTimeout(() => {
      setAnimationState('idle');
    }, 5000); // Platform-specific delay
  };

  // Keyboard trigger for desktop
  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      console.log('[AnimationTriggerTest] Keyboard shortcut (Ctrl/Cmd+K) detected');
      triggerAnimationSequence();
      setTestResults(prev => ({
        ...prev,
        keyboardShortcut: { success: true, timestamp: new Date().toISOString() }
      }));
    }
  };

  // Set up keyboard listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Get test status
  const getTestStatus = () => {
    if (platform === 'mobile') {
      return testResults.swipeDown?.success && testResults.tap?.success 
        ? 'All mobile triggers working' 
        : 'Some mobile triggers failed';
    } else {
      return testResults.keyboardShortcut?.success 
        ? 'Desktop trigger working' 
        : 'Desktop trigger failed';
    }
  };

  return (
    <div 
      ref={testContainerRef}
      className="animation-trigger-test"
      style={{
        padding: '20px',
        textAlign: 'center',
        backgroundColor: '#1a1a1a',
        color: 'white',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <h1>Cosmic Search Portal Animation Test</h1>
      
      <div style={{ marginBottom: '20px', fontSize: '1.2em' }}>
        <p><strong>Platform:</strong> {platform}</p>
        <p><strong>Touch Supported:</strong> {isTouchSupported ? 'Yes' : 'No'}</p>
        <p><strong>Reduced Motion:</strong> {reducedMotion ? 'Yes' : 'No'}</p>
        <p><strong>Fallback Active:</strong> {fallbackController.shouldUseFallback() ? 'Yes' : 'No'}</p>
      </div>
      
      <div style={{ 
        marginBottom: '20px', 
        padding: '15px', 
        borderRadius: '8px', 
        backgroundColor: '#333',
        minWidth: '300px'
      }}>
        <h3>Animation State: {animationState}</h3>
        <div style={{ 
          height: '20px', 
          backgroundColor: '#555', 
          borderRadius: '10px', 
          overflow: 'hidden',
          marginTop: '10px'
        }}>
          <div 
            style={{ 
              height: '100%', 
              width: animationState === 'idle' ? '0%' : 
                     animationState === 'initiating' ? '20%' : 
                     animationState === 'engaging' ? '40%' : 
                     animationState === 'shifting' ? '60%' : 
                     animationState === 'maxima' ? '80%' : '100%',
              backgroundColor: '#4CAF50',
              transition: 'width 0.5s ease-in-out'
            }}
          ></div>
        </div>
      </div>
      
      <div style={{ marginBottom: '20px' }}>
        <h3>Trigger Instructions:</h3>
        {platform === 'desktop' ? (
          <p>Press <kbd>Ctrl/Cmd</kbd> + <kbd>K</kbd> to trigger animation</p>
        ) : (
          <p>Swipe down or tap on the screen to trigger animation</p>
        )}
      </div>
      
      <div style={{ 
        marginBottom: '20px', 
        padding: '15px', 
        borderRadius: '8px', 
        backgroundColor: testResults[platform === 'mobile' ? 'swipeDown' : 'keyboardShortcut']?.success ? '#4CAF50' : '#f44336',
        color: 'white'
      }}>
        <p><strong>Test Status:</strong> {getTestStatus()}</p>
      </div>
      
      <div style={{ maxWidth: '600px', textAlign: 'left', backgroundColor: '#222', padding: '15px', borderRadius: '8px' }}>
        <h3>Test Results:</h3>
        <ul>
          {Object.entries(testResults).map(([trigger, result]) => (
            <li key={trigger}>
              <strong>{trigger}:</strong> {result.success ? '✓ Success' : '✗ Failed'} 
              {result.timestamp && ` at ${new Date(result.timestamp).toLocaleTimeString()}`}
            </li>
          ))}
        </ul>
      </div>
      
      <div style={{ marginTop: '20px', fontSize: '0.9em', color: '#aaa' }}>
        <p>Note: This test simulates the animation sequence. Actual animations are handled by the BackgroundAnimation component.</p>
        <p>On mobile, ensure swipe-down gesture works. On desktop, ensure keyboard shortcuts work.</p>
      </div>
      
      <style jsx>{`
        kbd {
          background-color: #333;
          border: 1px solid #555;
          border-radius: 3px;
          padding: 2px 6px;
          font-family: monospace;
        }
      `}</style>
    </div>
  );
};

export default AnimationTriggerTest;