/**
 * src/main.js
 * The Central Command: Links all modules and orchestrates the user experience.
 */

// Side-effect import: ensures Firebase initializes even if we don't reference exports here.
import './firebase.js';

import { stateManager } from './state.js';
import { router } from './router.js';
import { authModule } from './modules/auth.js';
import { modalManager } from './utils/modals.js';

// --- UI MODULES ---
import { dashboard } from './modules/dashboard.js';
import { analytics } from './modules/analytics.js';
import { settingsModule } from './modules/settings.js';
import { vault } from './modules/vault.js';
import { publicPortfolio } from './modules/publicportfolio.js';
import { investorPortal } from './modules/investorPortal.js';
import { deals } from './modules/deals.js';
import { properties } from './modules/properties.js';
import { projects } from './modules/projects.js';
import { investors } from './modules/investors.js';
import { contacts } from './modules/contacts.js';
import { tasks } from './modules/tasks.js';
import { llcs } from './modules/llcs.js';

import { activity } from './modules/activity.js';
import { calendar } from './modules/calendar.js';
import { dealAnalyzer } from './modules/deal-analyzer.js';
import { equityWaterfall } from './modules/equity-waterfall.js';
import { marketAnalysis } from './modules/market-analysis.js';
import { uploadManager as uploads } from './modules/uploads.js';

/**
 * Helper: safely call handlers so missing exports don’t break event delegation.
 */
function safeCall(fn, label) {
  if (typeof fn !== 'function') {
    console.warn(`Missing handler: ${label}`);
    return;
  }
  try {
    return fn();
  } catch (e) {
    console.error(`Handler failed: ${label}`, e);
  }
}

/**
 * Central view refresh
 */
function refreshCurrentView(view, state) {
  switch (view) {
    case 'dashboard': safeCall(() => dashboard.render(state), 'dashboard.render'); break;
    case 'analytics': safeCall(() => analytics.render(state), 'analytics.render'); break;

    case 'deals': safeCall(() => deals.render(state), 'deals.render'); break;
    case 'properties': safeCall(() => properties.render(state), 'properties.render'); break;
    case 'projects': safeCall(() => projects.render(state), 'projects.render'); break;

    case 'investors': safeCall(() => investors.render(state), 'investors.render'); break;
    case 'investor-portal': safeCall(() => investorPortal.render(state), 'investorPortal.render'); break;
    case 'public-portfolio': safeCall(() => publicPortfolio.render(state), 'publicPortfolio.render'); break;
    case 'contacts': safeCall(() => contacts.render(state), 'contacts.render'); break;

    case 'deal-analyzer': safeCall(() => dealAnalyzer.render(state), 'dealAnalyzer.render'); break;
    case 'market-analysis': safeCall(() => marketAnalysis.render(state), 'marketAnalysis.render'); break;
    case 'equity-waterfall': safeCall(() => equityWaterfall.render(state), 'equityWaterfall.render'); break;

    case 'vault': safeCall(() => vault.render(state), 'vault.render'); break;
    case 'uploads': safeCall(() => uploads.render(state), 'uploads.render'); break;
    case 'calendar': safeCall(() => calendar.render(state), 'calendar.render'); break;
    case 'activity': safeCall(() => activity.render(state), 'activity.render'); break;

    case 'tasks': safeCall(() => tasks.render(state), 'tasks.render'); break;
    case 'llcs': safeCall(() => llcs.render(state), 'llcs.render'); break;
    case 'settings': safeCall(() => settingsModule.render(state), 'settingsModule.render'); break;

    default:
      console.warn('Unknown view:', view);
  }
}

/**
 * 1. INITIALIZATION (after DOM is ready so modals + containers exist)
 */
document.addEventListener('DOMContentLoaded', () => {
  // Start auth listener
  safeCall(() => authModule.init(), 'authModule.init');

  // Init router
  safeCall(() => router.init(), 'router.init');

  // First render once state is ready (auth module calls stateManager.init on login)
  refreshCurrentView(router.getCurrentView(), stateManager.get?.() || {});
});

/**
 * Watch for state changes and re-render
 */
stateManager.subscribe((newState) => {
  refreshCurrentView(router.getCurrentView(), newState);
});

/**
 * Re-render on view change
 */
window.addEventListener('view-changed', (e) => {
  const view = e?.detail?.view || router.getCurrentView();
  refreshCurrentView(view, stateManager.get?.() || {});
});

/**
 * 2. GLOBAL EVENT DELEGATION
 */
document.addEventListener('click', async (e) => {
  const target = e.target.closest('[data-action]');
  if (!target) return;

  const action = target.dataset.action;
  const id = target.dataset.id;
  const state = stateManager.get();

  // Handle Navigation
  if (action === 'nav-link') {
    router.navigate(target.dataset.view);

    // close sidebar on mobile if present
    document.getElementById('sidebar')?.classList.add('-translate-x-full');
    document.getElementById('sidebarBackdrop')?.classList.add('hidden');
    return;
  }

  // Handle Logout
  if (action === 'logout') {
    modalManager.confirm(
      'Sign out?',
      'You will be signed out of Summit CRM.',
      async () => {
        await authModule.logout?.();
        return true;
      },
      { danger: true, confirmText: 'Sign out' }
    );
    return;
  }

  // Handle Data Actions
  switch (action) {
    // ---- ADD MODALS ----
    case 'deal-add':       safeCall(deals.showAddDealModal, 'deals.showAddDealModal'); break;
    case 'property-add':   safeCall(properties.showAddPropertyModal, 'properties.showAddPropertyModal'); break;
    case 'project-add':    safeCall(projects.showAddProjectModal, 'projects.showAddProjectModal'); break;
    case 'investor-add':   safeCall(investors.showAddInvestorModal, 'investors.showAddInvestorModal'); break;
    case 'task-add':       safeCall(tasks.showAddTaskModal, 'tasks.showAddTaskModal'); break;
    case 'contact-add':    safeCall(contacts.showAddContactModal, 'contacts.showAddContactModal'); break;
    case 'llc-add':        safeCall(llcs.showAddLLCModal, 'llcs.showAddLLCModal'); break;
    case 'vault-add':      safeCall(vault.showAddModal, 'vault.showAddModal'); break;

    // ---- QUICK TOGGLES / SIMPLE ACTIONS ----
    case 'task-toggle': {
      const task = state.tasks?.find(t => t.id === id);
      if (!task) return;
      stateManager.update('tasks', id, { completed: !task.completed });
      break;
    }

    default:
      // Let individual modules handle delegated actions they own
      // (No-op here by design)
      break;
  }
});
