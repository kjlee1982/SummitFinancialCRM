/**
 * src/router.js
 * Manages view states and browser hash navigation.
 * Expects containers with ids: #view-<viewName> and class .view-container
 */

const views = [
  'dashboard',
  'analytics',

  'deals',
  'properties',
  'projects',

  'investors',
  'investor-portal',
  'public-portfolio',
  'contacts',

  'deal-analyzer',
  'market-analysis',
  'crexi',
  'equity-waterfall',

  'vault',
  'uploads',
  'calendar',
  'activity',

  'tasks',
  'llcs',
  'settings'
];

let currentView = 'dashboard';

function normalizeView(v) {
  if (!v) return '';
  return String(v).trim().replace(/^#/, '');
}

function hideAllViews() {
  document.querySelectorAll('.view-container').forEach((el) => {
    el.classList.add('hidden');
  });
}

function showView(view) {
  const target = document.getElementById(`view-${view}`);
  if (!target) {
    console.warn(`router.navigate: missing container #view-${view}`);
    return false;
  }
  target.classList.remove('hidden');
  return true;
}

function dispatchViewChanged(view) {
  window.dispatchEvent(new CustomEvent('view-changed', { detail: { view } }));
}

export const router = {
  init() {
    // Back/forward + manual hash edits
    window.addEventListener('hashchange', () => {
      const hash = normalizeView(window.location.hash);
      if (views.includes(hash)) {
        this.navigate(hash, false);
      } else if (!hash) {
        // If hash cleared, return to default without pushing a new hash
        this.navigate(currentView || 'dashboard', false);
      } else {
        // Unknown hash: fall back
        console.warn(`router: unknown view "${hash}", redirecting to dashboard`);
        this.navigate('dashboard', true);
      }
    });

    // Initial route
    const initialHash = normalizeView(window.location.hash);
    if (views.includes(initialHash)) currentView = initialHash;

    // Ensure something is shown on first load
    this.navigate(currentView, false);
  },

  navigate(view, pushState = true) {
    const next = normalizeView(view);
    if (!views.includes(next)) {
      console.warn(`router.navigate: invalid view "${next}"`);
      return false;
    }

    currentView = next;

    // Update URL hash only for user-driven nav
    if (pushState) {
      const desired = `#${next}`;
      if (window.location.hash !== desired) window.location.hash = desired;
    }

    hideAllViews();
    const shown = showView(next);

    // Always dispatch so main.js can attempt to render
    dispatchViewChanged(next);

    return shown;
  },

  getCurrentView() {
    return currentView;
  },

  getViews() {
    return [...views];
  }
};
