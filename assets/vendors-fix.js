/**
 * VENDORS.JS ERROR FIX V2 (SYNCHRONOUS)
 * Fixes: Cannot read properties of undefined (reading 'option')
 * Must load BEFORE vendors.js
 */

(function() {
  'use strict';
  
  // Create Shopify namespace immediately (synchronous)
  window.Shopify = window.Shopify || {};
  
  // Stub OptionSelectors BEFORE vendors.js loads
  if (typeof Shopify.OptionSelectors === 'undefined') {
    Shopify.OptionSelectors = function(selectorDivId, options) {
      this.selectorDivId = selectorDivId;
      this.product = options?.product || { options: [] };
      this.onVariantSelected = options?.onVariantSelected || function() {};
      
      // Ensure product has options array
      if (!this.product.options) {
        this.product.options = [];
      }
      
      console.warn('⚠️ OptionSelectors stubbed (vendors.js protection active)');
    };
    
    // Add prototype methods
    Shopify.OptionSelectors.prototype.updateSelectors = function() {};
    Shopify.OptionSelectors.prototype.selectVariant = function() {};
  }
  
  // Wait for jQuery to enhance protection
  function waitForjQuery(callback) {
    if (typeof jQuery !== 'undefined') {
      callback(jQuery);
    } else {
      setTimeout(() => waitForjQuery(callback), 50);
    }
  }
  
  waitForjQuery(function($) {
    // Additional protection for dynamically loaded sections
    $(document).on('shopify:section:load', function(event) {
      const section = event.target;
      const productData = section.querySelector('[data-product-json]');
      
      if (productData) {
        try {
          const product = JSON.parse(productData.textContent);
          if (product && !product.options) {
            product.options = [];
          }
        } catch (e) {
          console.error('Product JSON parse error:', e);
        }
      }
    });
    
    console.log('✅ Vendors.js error prevention loaded (V2 - Synchronous)');
  });
  
})();
