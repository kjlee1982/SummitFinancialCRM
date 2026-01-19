/**
 * src/main.js
 * Bootstrap + global delegated actions (nav, sidebar, quick-add).
 */

import { router } from './router.js';
import { modalManager } from './modals.js';
import { authManager } from './modules/auth.js';

import { dashboard } from './modules/dashboard.js';
import { analytics } from './modules/analytics.js';
import { deals } from './modules/deals.js';
import { properties } from './modules/properties.js';
import { projects } from './modules/projects.js';
import { investors } from './modules/investors.js';
import { investorPortal } from './modules/investorPortal.js';

// IMPORTANT: GitHub Pages is case-sensitive.
// Your filename (per your folder list) is `publicportfolio.js` (lowercase p).
import { publicPortfolio } from './modules/publicportfolio.js';

import { contacts } from './modules/contacts.js';
import { tasks } from './modules/tasks.js';
import { llcs } from './modules/llcs.js';
import { settings } from './modules/settings.js';
import { vault } from './modules/vault.js';

// Added tools/views
import { dealAnalyzer } from './modules/deal-analyzer.js';
import { marketAnalysis } from './modules/market-analysis.js';
import { equityWaterfall } from './modules/equity-waterfall.js';
import { calendar } from './modules/calendar.js';
import { activity } from './modules/activity.js';
import { uploadManager as uploads } from './modules/uploads.js';

const viewRenderers = {
  dashboard: () => dashboard.render(),
  analytics: () => analytics.render(),

  deals: () => deals.render(),
  properties: () => properties.render(),
  projects: () => projects.render(),

  investors: () => investors.render(),
  'investor-portal': () => investorPortal.render(),
  'public-portfolio': () => publicPortfolio.render(),
  contacts: () => contacts.render(),

  'deal-analyzer': () => dealAnalyzer.render(),
  'market-analysis': () => marketAnalysis.render(),
  'equity-waterfall': () => equityWaterfall.render(),

  vault: () => vault.render(),
  uploads: () => uploads.render(),
  calendar: () => calendar.render(),
  activity: () => activity.render(),

  tasks: () => tasks.render(),
  llcs: () => llcs.render(),
  settings: () => settings.render()
};

function $(id) {
  return document.getElementById(id);
}

/** Mobile sidebar open/close */
function setSidebarOpen(isOpen) {
  const sidebar = $('sidebar');
  const backdrop = $('sidebarBackdrop');
  if (!sidebar || !backdrop) return;

  if (isOpen) {
    sidebar.classList.remove('-translate-x-full');
    backdrop.classList.remove('hidden');
  } else {
    sidebar.classList.add('-translate-x-full');
    backdrop.classList.add('hidden');
  }
}

function isMobile() {
  return window.matchMedia('(max-width: 767px)').matches;
}

function bindOnceGlobalHandlers() {
  if (window.__SUMMIT_BOUND__) return;
  window.__SUMMIT_BOUND__ = true;

  // Sidebar toggle button (mobile)
  const toggleBtn = $('sidebarToggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const sidebar = $('sidebar');
      const open = sidebar ? sidebar.classList.contains('-translate-x-full') : false;
      setSidebarOpen(open); // if currently hidden -> open it
    });
  }

  // Backdrop closes sidebar (mobile)
  const backdrop = $('sidebarBackdrop');
  if (backdrop) {
    backdrop.addEventListener('click', () => setSidebarOpen(false));
  }

  // Delegated clicks (nav + actions)
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;

    const action = btn.getAttribute('data-action');

    // Navigation
    if (action === 'nav-link') {
      const view = btn.getAttribute('data-view');
      if (view) {
        router.navigate(view, true);
        if (isMobile()) setSidebarOpen(false);
      }
      return;
    }

    // Logout
    if (action === 'logout') {
      modalManager.confirm({
        title: 'Sign out?',
        message: 'You will be signed out of Summit CRM.',
        danger: true,
        confirmText: 'Sign out',
        onConfirm: async () => {
          await authManager.signOut();
          return true;
        }
      });
      return;
    }
  });
}

function renderCurrentView(view) {
  const fn = viewRenderers[view];
  if (!fn) {
    console.warn(`main.js: No renderer registered for view "${view}"`);
    return;
  }

  try {
    fn();
  } catch (err) {
    console.error(`Render failed for view "${view}"`, err);
    modalManager.alert({
      title: 'Render error',
      message: `Failed to render "${view}". Check console for details.`
    });
  }
}

// When router changes views, render the new one
window.addEventListener('view-changed', (e) => {
  const view = e?.detail?.view || router.getCurrentView();
  renderCurrentView(view);
});

document.addEventListener('DOMContentLoaded', () => {
  bindOnceGlobalHandlers();

  // Auth init (safe even if your auth module no-ops locally)
  try {
    authManager.init?.();
  } catch (e) {
    console.warn('authManager.init failed', e);
  }

  // Start router (will dispatch view-changed)
  router.init();
});
