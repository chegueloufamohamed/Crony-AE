// CRONY.AE PERFORMANCE CONTROLLER v4.1
(function () {
  'use strict';

  /* ----------------------------------
     UTILITY HELPERS
  ----------------------------------- */
  function onIdle(fn) {
    if ('requestIdleCallback' in window) requestIdleCallback(fn, { timeout: 2500 });
    else setTimeout(fn, 1500);
  }

  function safeLog() {
    // enable only for debugging
    // console.log.apply(console, arguments);
  }

  /* ----------------------------------
     LAZY LOADER FOR LOW PRIORITY APPS
  ----------------------------------- */
  function loadLazyScripts() {
    const nodes = document.querySelectorAll('script[data-crony-lazy="true"][data-src]');
    nodes.forEach(node => {
      if (node.dataset.cronyLoaded === '1') return;

      const src = node.dataset.src;
      if (!src) return;

      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      document.head.appendChild(s);

      node.dataset.cronyLoaded = '1';
      safeLog('[CronyPerf] Lazy-loaded:', src);
    });
  }

  /* ----------------------------------
     RERUN REGISTERED OPTIMIZERS
  ----------------------------------- */
  function rerunOptimizers(context) {
    context = context || 'runtime';

    if (window.CronyImageOptimizer?.rerun) {
      try { window.CronyImageOptimizer.rerun(); } catch (_) {}
    }
    if (window.CronyPerformance?.rerun) {
      try { window.CronyPerformance.rerun(); } catch (_) {}
    }
  }

  /* ----------------------------------
     FLICKITY A11Y PATCH (ARIA FIX)
  ----------------------------------- */
  function fixAria() {
    const slides = document.querySelectorAll(
      '.gallery-cell, .crony-slide, .testimonial-block'
    );

    slides.forEach(slide => {
      slide.removeAttribute('aria-selected');
      slide.setAttribute(
        'aria-hidden',
        slide.classList.contains('is-selected') ? 'false' : 'true'
      );
    });
  }

  function bindA11yHooks() {
    const slider = document.querySelector('[data-slider-id]');
    if (!slider) return;

    function getFlk() {
      if (slider.flickity) return slider.flickity;
      if (window.jQuery) {
        const $ = window.jQuery;
        return $(slider).data('flickity') || $(slider).data('flickity-instance');
      }
      return null;
    }

    const flk = getFlk();
    if (!flk || flk._cronyPatched) return;

    flk._cronyPatched = true;
    flk.on('select', fixAria);
    flk.on('settle', fixAria);

    setTimeout(fixAria, 300);
  }

  /* ----------------------------------
     LCP FIX: FORCE FIRST SLIDE IMAGE EAGER
  ----------------------------------- */
  function ensureLCPImageCorrect() {
    const img = document.querySelector(
      '.gallery-cell.is-selected img, .crony-slide.is-selected img'
    );
    if (!img) return;

    img.loading = 'eager';
    img.setAttribute('fetchpriority', 'high');
    img.decoding = 'sync';

    if (!img.alt || img.alt.trim() === '') {
      img.alt = document.title + ' Featured Image';
    }
  }

  /* ----------------------------------
     ACCESSIBLE BANNER LINKS FIX
  ----------------------------------- */
  function fixBannerLinks() {
    const links = document.querySelectorAll('a.banner-full-link');

    links.forEach((link, i) => {
      if (!link.textContent.trim()) {
        const span = document.createElement('span');
        span.className = 'visually-hidden';
        span.textContent = `View slide ${i + 1}`;
        link.appendChild(span);
      }
    });
  }

  /* ----------------------------------
     InstantClick Support
  ----------------------------------- */
  function hookInstantClick() {
    if (!window.InstantClick?.on) return;

    window.InstantClick.on('change', function () {
      rerunOptimizers('instantclick');
      onIdle(loadLazyScripts);
      setTimeout(() => {
        bindA11yHooks();
        ensureLCPImageCorrect();
        fixBannerLinks();
      }, 300);
    });
  }

  /* ----------------------------------
     Shopify Script Interceptor
  ----------------------------------- */
  function interceptInjectedScripts() {
    const lazyPatterns = [
      'clarity.ms', 'seoant', 'hotjar', 'judge.me', 'review',
      'loox', 'klaviyo', 'intercom', 'tiktok', 'criteo',
      'taboola', 'bing.com'
    ];

    const allowPatterns = [
      'googletagmanager.com',
      'gtm.js',
      'gtag/js',
      'connect.facebook.net/en_US/fbevents.js',
      'shopify'
    ];

    const observer = new MutationObserver(mutations => {
      mutations.forEach(m => {
        m.addedNodes.forEach(node => {
          if (node.tagName !== 'SCRIPT' || !node.src) return;

          const url = node.src.toLowerCase();

          if (allowPatterns.some(p => url.includes(p))) return;

          if (lazyPatterns.some(p => url.includes(p))) {
            if (!node.dataset.cronyHandled) {
              node.dataset.cronyHandled = '1';
              node.dataset.src = node.src;
              node.type = 'text/plain';
              node.dataset.cronyLazy = 'true';
              node.removeAttribute('src');

              console.log(
                '%c[Deferred Tracker]',
                'color:orange;font-weight:bold;',
                node.dataset.src
              );

              onIdle(loadLazyScripts);
            }
          }
        });
      });
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  /* ----------------------------------
     INIT
  ----------------------------------- */
  function init() {
    window.addEventListener('load', function () {
      rerunOptimizers('load');
      onIdle(loadLazyScripts);
      hookInstantClick();
      interceptInjectedScripts();

      // Run accessibility + LCP fixes safely
      setTimeout(() => {
        bindA11yHooks();
        ensureLCPImageCorrect();
        fixBannerLinks();
      }, 400);
    });
  }

  init();

  /* Public API */
  window.CronyPerformanceController = {
    rerunOptimizers,
    loadLazyScripts
  };

})();
