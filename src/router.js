/**
 * src/router.js
 * Manages view states and browser history.
 */

const views = [
  'dashboard',
  'analytics',
  'deals',
  'properties',
  'projects',
  'investors',
  'vault',
  'contacts',
  'tasks',
  'llcs',
  'settings',
  'public-portfolio',
  'investor-portal',

  // Added views (must match your data-view + main.js switch cases)
  'uploads',
  'calendar',
  'activity',
  'deal-analyzer',
  'equity-waterfall',
  'market-analysis'
];

let currentView = 'dashboard';

// Prevent duplicate renders: navigate() sets location.hash which triggers hashchange.
// We'll ignore the next hashchange when it was initiated by navigate().
let ignoreNextHashChange = false;

export const router = {
  init() {
    // Handle hash navigation (back/forward + manual edits)
    window.addEventListener('hashchange', () => {
      if (ignoreNextHashChange) {
        ignoreNextHashChange = false;
        return;
      }

      const hash = window.location.hash.replace('#', '');
      if (views.includes(hash)) {
        this.navigate(hash, false);
      }
    });

    // Initial route check + render
    const initialHash = window.location.hash.replace('#', '');
    if (views.includes(initialHash)) {
      currentView = initialHash;
    }

    // Ensure correct view is shown on first load
    this.navigate(currentView, false);
  },

  navigate(view, pushState = true) {
    if (!views.includes(view)) return;

    currentView = view;

    // Update URL hash (only when user clicked a nav item)
    if (pushState) {
      ignoreNextHashChange = true;
      window.location.hash = view;
    }

    // Hide all views
    document.querySelectorAll('.view-container').forEach(el => {
      el.classList.add('hidden');
    });

    // Show target view
    const target = document.getElementById(`view-${view}`);
    if (target) {
      target.classList.remove('hidden');
    } else {
      console.warn(`router.navigate: missing container #view-${view}`);
    }

    // Dispatch global event for main.js to re-render
    window.dispatchEvent(new CustomEvent('view-changed', { detail: { view } }));
  },

  getCurrentView() {
    return currentView;
  }
};
