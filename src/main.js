/**
 * src/main.js
 * App bootstrap: auth + state + router + view rendering + sidebar controls
 */

import { router } from './router.js';
import { stateManager } from './state.js';

import { authModule } from './modules/auth.js';

import { dashboard } from './modules/dashboard.js';
import { analytics } from './modules/analytics.js';
import { deals } from './modules/deals.js';
import { properties } from './modules/properties.js';
import { projects } from './modules/projects.js';
import { investors } from './modules/investors.js';
import { investorPortal } from './modules/investorPortal.js';

import { contacts } from './modules/contacts.js';
import { tasks } from './modules/tasks.js';
import { llcs } from './modules/llcs.js';

import { vault } from './modules/vault.js';
import { uploads } from './modules/uploads.js';
import { calendar } from './modules/calendar.js';
import { activity } from './modules/activity.js';

import { dealAnalyzer } from './modules/deal-analyzer.js';
import { marketAnalysis } from './modules/market-analysis.js';
import { equityWaterfall } from './modules/equity-waterfall.js';

import { publicPortfolio } from './modules/publicportfolio.js'; // ✅ correct filename casing
import { settingsModule } from './modules/settings.js';

let appState = stateManager.getState?.() || {};

/* -----------------------------
   Sidebar controls (mobile)
------------------------------ */

function isMobile() {
  return window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
}

function setSidebarOpen(open) {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (!sidebar || !backdrop) return;

  if (open) {
    sidebar.classList.remove('-translate-x-full');
    backdrop.classList.remove('hidden');
  } else {
    sidebar.classList.add('-translate-x-full');
    backdrop.classList.add('hidden');
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  const open = sidebar.classList.contains('-translate-x-full');
  setSidebarOpen(open);
}

/* -----------------------------
   Rendering
------------------------------ */

function renderCurrentView() {
  const view = router.getCurrentView();

  try {
    switch (view) {
      case 'dashboard': dashboard.render(appState); break;
      case 'analytics': analytics.render(appState); break;

      case 'deals': deals.render(appState); break;
      case 'properties': properties.render(appState); break;
      case 'projects': projects.render(appState); break;

      case 'investors': investors.render(appState); break;
      case 'investor-portal': investorPortal.render(appState); break;
      case 'public-portfolio': publicPortfolio.render(appState); break;

      case 'contacts': contacts.render(appState); break;
      case 'tasks': tasks.render(appState); break;
      case 'llcs': llcs.render(appState); break;

      case 'vault': vault.render(appState); break;
      case 'uploads': uploads.render(appState); break;
      case 'calendar': calendar.render(appState); break;
      case 'activity': activity.render(appState); break;

      case 'deal-analyzer': dealAnalyzer.render(appState); break;
      case 'market-analysis': marketAnalysis.render(appState); break;
      case 'equity-waterfall': equityWaterfall.render(appState); break;

      case 'settings': settingsModule.render(appState); break;

      default:
        dashboard.render(appState);
        break;
    }
  } catch (err) {
    console.error(`Render error in view "${view}":`, err);
  }
}

/* -----------------------------
   Global delegated events
------------------------------ */

let boundOnce = false;
function bindGlobalEventsOnce() {
  if (boundOnce) return;
  boundOnce = true;

  document.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.getAttribute('data-action');

    if (action === 'toggle-sidebar') {
      toggleSidebar();
      return;
    }

    if (action === 'nav-link') {
      const view = btn.getAttribute('data-view');
      if (!view) return;

      router.navigate(view, true);

      // On mobile, close the drawer after navigation
      if (isMobile()) setSidebarOpen(false);
      return;
    }

    if (action === 'logout') {
      try {
        await authModule.logout();
      } catch (err) {
        console.error('Logout failed:', err);
      }
      return;
    }
  });

  // Clicking backdrop closes sidebar
  const backdrop = document.getElementById('sidebarBackdrop');
  if (backdrop) {
    backdrop.addEventListener('click', () => setSidebarOpen(false));
  }

  // Keep sidebar state sane on resize (if switching between mobile/desktop)
  window.addEventListener('resize', () => {
    if (!isMobile()) {
      // Ensure visible on desktop
      setSidebarOpen(true);
    } else {
      // Default closed on mobile
      setSidebarOpen(false);
    }
  });
}

/* -----------------------------
   Bootstrap
------------------------------ */

function init() {
  bindGlobalEventsOnce();

  // Subscribe to state updates -> rerender current view
  if (typeof stateManager.subscribe === 'function') {
    stateManager.subscribe((s) => {
      appState = s || {};
      renderCurrentView();
    });
  } else {
    appState = stateManager.getState?.() || {};
  }

  // Router drives view visibility + dispatches view-changed
  router.init();

  window.addEventListener('view-changed', () => {
    appState = stateManager.getState?.() || appState || {};
    renderCurrentView();
  });

  // Auth last (it may load user + trigger state loads)
  authModule.init();

  // Ensure correct sidebar default on load
  if (!isMobile()) setSidebarOpen(true);
  else setSidebarOpen(false);

  // First render
  renderCurrentView();
}

init();
