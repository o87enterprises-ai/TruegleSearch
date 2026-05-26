/**
 * Touch Gesture Handler for Mobile Devices
 * Implements swipe-down and other touch gestures for mobile animation triggers
 */

export class TouchGestureHandler {
  constructor(element, callbacks = {}) {
    this.element = element;
    this.callbacks = callbacks;
    this.touchStartY = 0;
    this.touchStartX = 0;
    this.isDragging = false;
    this.dragDirection = null;
    this.startTime = 0;
    this.hasTriggered = false;
    
    // Gesture configuration
    this.config = {
      swipeThreshold: 100,    // Minimum distance in pixels
      velocityThreshold: 0.5, // Minimum velocity in pixels/ms
      longPressDuration: 800, // Duration in ms for long press
      doubleTapInterval: 300, // Max time between taps for double tap
      lastTapTime: 0,
    };
    
    this.init();
  }

  init() {
    if (!this.element) return;
    
    // Touch events
    this.element.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.element.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.element.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
    
    // Mouse events as fallback
    this.element.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.element.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.element.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.element.addEventListener('mouseleave', this.handleMouseUp.bind(this));
  }

  handleTouchStart(e) {
    if (e.touches.length > 1) return; // Ignore multi-touch
    
    const touch = e.touches[0];
    this.touchStartY = touch.clientY;
    this.touchStartX = touch.clientX;
    this.startTime = Date.now();
    this.isDragging = false;
    this.dragDirection = null;
    this.hasTriggered = false;
    
    // Check for long press
    clearTimeout(this.longPressTimer);
    this.longPressTimer = setTimeout(() => {
      if (!this.isDragging && !this.hasTriggered) {
        this.hasTriggered = true;
        this.triggerEvent('longpress');
        this.applyHapticFeedback('light');
      }
    }, this.config.longPressDuration);
  }

  handleTouchMove(e) {
    if (e.touches.length > 1) return;
    
    e.preventDefault(); // Prevent scrolling during gesture
    
    const touch = e.touches[0];
    const deltaY = touch.clientY - this.touchStartY;
    const deltaX = touch.clientX - this.touchStartX;
    const deltaTime = Date.now() - this.startTime;
    
    // Determine drag direction
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
      this.dragDirection = deltaY > 0 ? 'down' : 'up';
    } else if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      this.dragDirection = deltaX > 0 ? 'right' : 'left';
    }
    
    if (Math.abs(deltaY) > 10 || Math.abs(deltaX) > 10) {
      this.isDragging = true;
    }
    
    // Check for swipe during drag
    if (this.isDragging && !this.hasTriggered) {
      if (this.dragDirection === 'down' && deltaY > this.config.swipeThreshold) {
        const velocity = deltaY / deltaTime;
        if (velocity > this.config.velocityThreshold) {
          this.hasTriggered = true;
          this.triggerEvent('swipedown');
          this.applyHapticFeedback('medium');
          clearTimeout(this.longPressTimer);
        }
      } else if (this.dragDirection === 'up' && Math.abs(deltaY) > this.config.swipeThreshold) {
        const velocity = Math.abs(deltaY) / deltaTime;
        if (velocity > this.config.velocityThreshold) {
          this.hasTriggered = true;
          this.triggerEvent('swipeup');
          this.applyHapticFeedback('medium');
          clearTimeout(this.longPressTimer);
        }
      }
    }
  }

  handleTouchEnd(e) {
    clearTimeout(this.longPressTimer);
    
    if (!this.isDragging && !this.hasTriggered) {
      // Check for tap or double tap
      const currentTime = Date.now();
      const tapLength = currentTime - this.startTime;
      
      if (tapLength < 300) { // Valid tap
        if (currentTime - this.config.lastTapTime < this.config.doubleTapInterval) {
          // Double tap
          this.triggerEvent('doubletap');
          this.applyHapticFeedback('light');
          this.config.lastTapTime = 0; // Reset to prevent triple tap confusion
        } else {
          // Single tap
          this.triggerEvent('tap');
          this.applyHapticFeedback('light');
          this.config.lastTapTime = currentTime;
        }
      }
    }
    
    this.isDragging = false;
    this.dragDirection = null;
  }

  // Mouse event handlers (fallback for testing on desktop)
  handleMouseDown(e) {
    this.touchStartY = e.clientY;
    this.touchStartX = e.clientX;
    this.startTime = Date.now();
    this.isDragging = false;
    this.dragDirection = null;
    this.hasTriggered = false;
    
    // Add mouse move and up listeners to the document
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    document.addEventListener('mouseup', this.handleMouseUp.bind(this));
  }

  handleMouseMove(e) {
    if (!this.touchStartY) return;
    
    const deltaY = e.clientY - this.touchStartY;
    const deltaX = e.clientX - this.touchStartX;
    const deltaTime = Date.now() - this.startTime;
    
    // Determine drag direction
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
      this.dragDirection = deltaY > 0 ? 'down' : 'up';
    } else if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      this.dragDirection = deltaX > 0 ? 'right' : 'left';
    }
    
    if (Math.abs(deltaY) > 10 || Math.abs(deltaX) > 10) {
      this.isDragging = true;
    }
    
    // Check for swipe during drag
    if (this.isDragging && !this.hasTriggered) {
      if (this.dragDirection === 'down' && deltaY > this.config.swipeThreshold) {
        const velocity = deltaY / deltaTime;
        if (velocity > this.config.velocityThreshold) {
          this.hasTriggered = true;
          this.triggerEvent('swipedown');
          this.applyHapticFeedback('medium');
        }
      } else if (this.dragDirection === 'up' && Math.abs(deltaY) > this.config.swipeThreshold) {
        const velocity = Math.abs(deltaY) / deltaTime;
        if (velocity > this.config.velocityThreshold) {
          this.hasTriggered = true;
          this.triggerEvent('swipeup');
          this.applyHapticFeedback('medium');
        }
      }
    }
  }

  handleMouseUp(e) {
    // Remove mouse move and up listeners
    document.removeEventListener('mousemove', this.handleMouseMove.bind(this));
    document.removeEventListener('mouseup', this.handleMouseUp.bind(this));
    
    this.isDragging = false;
    this.dragDirection = null;
  }

  triggerEvent(eventName) {
    if (this.callbacks[eventName]) {
      this.callbacks[eventName]();
    }
    
    // Trigger custom event
    const customEvent = new CustomEvent(`gesture:${eventName}`, {
      detail: { gesture: eventName }
    });
    this.element.dispatchEvent(customEvent);
  }

  applyHapticFeedback(type = 'light') {
    // Apply haptic feedback if supported
    if (navigator.vibrate) {
      const pattern = this.getHapticPattern(type);
      navigator.vibrate(pattern);
    }
  }

  getHapticPattern(type) {
    switch (type) {
      case 'light':
        return [10]; // Light vibration
      case 'medium':
        return [20]; // Medium vibration
      case 'heavy':
        return [30]; // Heavy vibration
      case 'selection':
        return [10, 10, 10]; // Selection haptic
      default:
        return [10];
    }
  }

  destroy() {
    if (this.element) {
      this.element.removeEventListener('touchstart', this.handleTouchStart.bind(this));
      this.element.removeEventListener('touchmove', this.handleTouchMove.bind(this));
      this.element.removeEventListener('touchend', this.handleTouchEnd.bind(this));
      
      this.element.removeEventListener('mousedown', this.handleMouseDown.bind(this));
      this.element.removeEventListener('mousemove', this.handleMouseMove.bind(this));
      this.element.removeEventListener('mouseup', this.handleMouseUp.bind(this));
      this.element.removeEventListener('mouseleave', this.handleMouseUp.bind(this));
    }
    
    clearTimeout(this.longPressTimer);
  }
}

// Convenience function to attach touch gestures to an element
export const attachTouchGestures = (element, callbacks) => {
  return new TouchGestureHandler(element, callbacks);
};

// Hook for React components
export const useTouchGestures = (ref, callbacks) => {
  let handler = null;
  
  if (ref && ref.current) {
    handler = new TouchGestureHandler(ref.current, callbacks);
  }
  
  // Cleanup function
  const cleanup = () => {
    if (handler) {
      handler.destroy();
    }
  };
  
  return { handler, cleanup };
};

// Default gesture configuration
export const DEFAULT_GESTURE_CONFIG = {
  swipeDown: {
    threshold: 100,    // pixels
    velocity: 0.5,     // pixels/ms
    trigger: "startSearchAnimation",
    haptic: "medium"
  },
  
  swipeUp: {
    threshold: 100,
    velocity: 0.5,
    trigger: "closeSearchAnimation",
    haptic: "medium"
  },
  
  longPress: {
    duration: 800,     // ms
    trigger: "previewAnimation",
    haptic: "light"
  },
  
  tap: {
    trigger: "activateElement",
    haptic: "light"
  },
  
  doubleTap: {
    trigger: "zoomElement",
    haptic: "light"
  }
};

export default TouchGestureHandler;