// CSS Debug Utility
export const cssDebug = {
  logInvalidStyles: () => {
    console.log('=== CSS DEBUG ===');
    
    // Check for elements with potentially invalid styles
    const elementsWithStyles = document.querySelectorAll('[style]');
    console.log(`Elements with inline styles: ${elementsWithStyles.length}`);
    
    elementsWithStyles.forEach((el, i) => {
      const style = el.getAttribute('style');
      if (style.includes('undefined') || style.includes('NaN') || style.includes('null')) {
        console.warn(`Element ${i} has invalid style:`, {
          tag: el.tagName,
          className: el.className,
          style: style,
          parent: el.parentElement?.tagName
        });
      }
    });
    
    // Check specific problematic properties
    const checkProperties = ['text-shadow', 'filter', 'opacity', 'mask-composite'];
    checkProperties.forEach(prop => {
      const elements = document.querySelectorAll(`[style*="${prop}"]`);
      console.log(`Elements with ${prop}: ${elements.length}`);
    });
    
    return elementsWithStyles.length;
  },
  
  fixInvalidStyles: () => {
    const elementsWithStyles = document.querySelectorAll('[style]');
    let fixedCount = 0;
    
    elementsWithStyles.forEach(el => {
      let style = el.getAttribute('style');
      if (style) {
        // Remove undefined values
        const originalStyle = style;
        style = style.replace(/undefined/g, '');
        style = style.replace(/NaN/g, '');
        style = style.replace(/null/g, '');
        
        // Fix common issues
        style = style.replace(/text-shadow:\s*;/g, '');
        style = style.replace(/filter:\s*;/g, '');
        style = style.replace(/opacity:\s*;/g, '');
        
        if (style !== originalStyle) {
          el.setAttribute('style', style);
          fixedCount++;
        }
      }
    });
    
    console.log(`Fixed ${fixedCount} invalid styles`);
    return fixedCount;
  }
};
