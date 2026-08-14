/**
 * Performance Optimization Utilities for Truegle
 * 
 * This module contains utilities for optimizing Core Web Vitals and page load speeds
 */

// Function to preload critical resources
export const preloadResource = (url, asType) => {
  if (!url) return;
  
  // Check if resource is already preloaded
  const existingLink = document.querySelector(`link[href="${url}"]`);
  if (existingLink) return;

  const link = document.createElement('link');
  link.rel = 'preload';
  link.href = url;
  if (asType) link.as = asType;
  link.crossOrigin = 'anonymous';
  document.head.appendChild(link);
};

// Function to implement lazy loading for images
export const lazyLoadImage = (imageElement) => {
  if (!imageElement) return;
  
  // Create an Intersection Observer to load images when they come into view
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        img.src = img.dataset.src;
        img.classList.remove('lazy');
        img.classList.add('loaded');
        observer.unobserve(img);
      }
    });
  });

  imageObserver.observe(imageElement);
};

// Function to optimize font loading
export const optimizeFonts = () => {
  // Preload critical fonts
  const criticalFonts = [
    { url: '/fonts/critical-font.woff2', as: 'font', type: 'font/woff2' },
  ];

  criticalFonts.forEach(font => {
    preloadResource(font.url, font.as);
  });

  // Add font display swap for better loading
  const style = document.createElement('style');
  style.textContent = `
    @font-face {
      font-display: swap;
    }
  `;
  document.head.appendChild(style);
};

// Function to implement resource hints
export const addResourceHints = () => {
  // DNS prefetch for external domains
  const domains = [
    'https://api-inference.huggingface.co',
    'https://fonts.googleapis.com',
    'https://fonts.gstatic.com',
  ];

  domains.forEach(domain => {
    const link = document.createElement('link');
    link.rel = 'dns-prefetch';
    link.href = domain;
    document.head.appendChild(link);
  });

  // Preconnect to critical third-party origins
  const origins = [
    'https://api-inference.huggingface.co',
    'https://fonts.googleapis.com',
  ];

  origins.forEach(origin => {
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = origin;
    document.head.appendChild(link);
  });
};

// Function to optimize critical CSS
export const optimizeCriticalCSS = () => {
  // Inline critical CSS for above-the-fold content
  const criticalCSS = `
    /* Critical styles for initial render */
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif; }
    .header { display: flex; align-items: center; padding: 1rem; }
    .search-bar { width: 100%; max-width: 600px; margin: 0 auto; }
    .logo { height: 2rem; }
  `;

  const style = document.createElement('style');
  style.id = 'critical-css';
  style.textContent = criticalCSS;
  document.head.appendChild(style);
};

// Function to implement script optimization
export const optimizeScripts = () => {
  // Add loading strategies to scripts
  const scripts = document.querySelectorAll('script[data-module]');
  scripts.forEach(script => {
    script.setAttribute('async', '');
  });
};

// Function to measure Core Web Vitals
export const measureCoreWebVitals = () => {
  // This would typically integrate with the Web Vitals library
  // For now, we'll just set up the basic structure
  if ('PerformanceObserver' in window) {
    // Core Web Vitals measurement would go here
    console.log('Core Web Vitals measurement initialized');
  }
};

// Resource caching: DELIBERATELY NOT A SERVICE WORKER.
//
// This used to call navigator.serviceWorker.register('/sw.js'), and nothing
// called it — which is the only reason it never fired. /sw.js is not a cache;
// it is the SELF-DESTRUCTING KILL SWITCH left behind after a third-party ad
// worker was served from that path on 2026-06-15. It claims control, deletes
// every cache, unregisters itself and navigates every open tab. Wiring this
// function up would have registered that, on every page load, for everyone.
//
// The function is kept as a marker rather than deleted so the next person to
// reach for offline caching reads this first. If Truegle ever does want a real
// worker, it needs a deliberate decision about the kill switch — two workers
// cannot share a scope, so registering a new one at '/' REPLACES the cleanup
// for any browser that has not yet been cleaned.
//
// The encyclopedia on the 404 page solves offline a different way: it hands
// the reader a self-contained file. A file on their disk survives cache
// eviction, "clear browsing data" and this site disappearing. A cache entry
// survives none of those.
export const setupResourceCaching = () => {};

// Main function to run all optimizations
export const optimizePerformance = () => {
  optimizeFonts();
  addResourceHints();
  optimizeCriticalCSS();
  optimizeScripts();
  measureCoreWebVitals();
  
  console.log('Performance optimizations applied');
};

// Function to defer non-critical CSS
export const deferNonCriticalCSS = () => {
  const loadCSS = (href) => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.media = 'print';
    link.onload = () => link.media = 'all';
    
    document.head.appendChild(link);
  };

  // Find non-critical CSS files and defer them
  const nonCriticalCSS = Array.from(document.styleSheets)
    .filter(sheet => !sheet.href?.includes('critical'))
    .map(sheet => sheet.href)
    .filter(href => href);

  nonCriticalCSS.forEach(href => loadCSS(href));
};

// Function to implement image optimization
export const optimizeImages = () => {
  // Add loading="lazy" to images that are below the fold
  const images = document.querySelectorAll('img[data-lazy]');
  images.forEach(img => {
    img.setAttribute('loading', 'lazy');
    img.setAttribute('decoding', 'async');
  });
};

// Function to implement resource cleanup
export const cleanupResources = () => {
  // Clean up any performance-related resources when needed
  window.addEventListener('beforeunload', () => {
    // Perform cleanup tasks
  });
};