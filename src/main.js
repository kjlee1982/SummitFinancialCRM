/**
 * src/main.js
 * The Central Command: Links all modules and orchestrates the user experience.
 */

// Side-effect import: ensures Firebase initializes even if we don't reference exports here.
import './firebase.js';

import { stateManager } from './state.js';
import { router } from './router.js';
import { authModule } from './modules/auth.js';

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
    fn();
  } catch (e) {
    console.error(`Handler failed: ${label}`, e);
  }
}

/**
 * Sidebar (mobile drawer) controller
 * - Desktop: sidebar always visible (md:translate-x-0), backdrop always hidden
 * - Mobile: sidebar uses translate classes + backdrop for click-away
 */
const sidebarUI = (() => {
  let open = false;

  const isMobile = () => window.innerWidth < 768;

  const getEls = () => ({
    sidebar: document.getElementById('sidebar'),
    backdrop: document.getElementById('sidebarBackdrop'),
    toggle: document.getElementById('sidebarToggle'),
  });

  function apply(openWanted) {
    const { sidebar, backdrop } = getEls();
    if (!sidebar || !backdrop) return;

    // Desktop: never show backdrop, let md:translate-x-0 rule win
    if (!isMobile()) {
      open = false;
      backdrop.classList.add('hidden');
      // Remove any mobile "forced open" class so md:translate-x-0 governs
      sidebar.classList.remove('translate-x-0');
      // Keep -translate-x-full present; md:translate-x-0 overrides at desktop
      if (!sidebar.classList.contains('-translate-x-full')) {
        sidebar.classList.add('-translate-x-full');
      }
      return;
    }

    open = !!openWanted;

    if (open) {
      sidebar.classList.remove('-translate-x-full');
      sidebar.classList.add('translate-x-0');
      backdrop.classList.remove('hidden');
    } else {
      sidebar.classList.add('-translate-x-full');
      sidebar.classList.remove('translate-x-0');
      backdrop.classList.add('hidden');
    }
  }

  function toggle() {
    apply(!open);
  }

  function closeIfMobile() {
    if (isMobile()) apply(false);
  }

  function bindOnce() {
    const { toggle: btn, backdrop } = getEls();

    // Ensure consistent initial state after DOM is ready
    apply(false);

    btn?.addEventListener('click', () => toggle());

    backdrop?.addEventListener('click', () => apply(false));

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') apply(false);
    });

    window.addEventListener('resize', () => {
      // Keep state sane across rotations/resizes
      apply(open);
    });
  }

  return { bindOnce, closeIfMobile, apply };
})();

/**
 * 1. INITIALIZATION
 */
authModule.init();
router.init();

// Bind sidebar behavior once (safe even if called early)
document.addEventListener('DOMContentLoaded', () => {
  sidebarUI.bindOnce();
});

// Watch for state changes and re-render
stateManager.subscribe((newState) => {
  refreshCurrentView(router.getCurrentView(), newState);
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
    // Close drawer only on mobile (desktop stays visible)
    sidebarUI.closeIfMobile();
    return;
  }

  // Handle Data Actions
  switch (action) {
    // ---- ADD MODALS (safe-called to avoid regressions) ----
    case 'deal-add':
      safeCall(deals.showAddDealModal, 'deals.showAddDealModal');
      break;
    case 'property-add':
      safeCall(properties.showAddPropertyModal, 'properties.showAddPropertyModal');
      break;
    case 'project-add':
      safeCall(projects.showAddProjectModal, 'projects.showAddProjectModal');
      break;
    case 'investor-add':
      safeCall(investors.showAddInvestorModal, 'investors.showAddInvestorModal');
      break;
    case 'task-add':
      safeCall(tasks.showAddTaskModal, 'tasks.showAddTaskModal');
      break;
    case 'contact-add':
      safeCall(contacts.showAddContactModal, 'contacts.showAddContactModal');
      break;
    case 'llc-add':
      safeCall(llcs.showAddLLCModal, 'llcs.showAddLLCModal');
      break;
    case 'vault-add':
      safeCall(vault.showAddModal, 'vault.showAddModal');
      break;

    // ---- QUICK TOGGLES / SIMPLE ACTIONS ----
    case 'task-toggle': {
      const task = state.tasks?.find(t => t.id === id);
      if (!task) {
        console.warn('task-toggle: task not found', { id });
        return;
      }
      stateManager.update('tasks', id, { completed: !task.completed });
      break;
    }

    // ---- DELETES (confirm + delete) ----
    case 'prop-delete':
      if (confirm("Permanently delete this asset?")) stateManager.delete('properties', id);
      break;

    case 'project-delete':
      if (confirm("Remove this project?")) stateManager.delete('projects', id);
      break;

    case 'investor-delete':
      if (confirm("Remove investor record?")) stateManager.delete('investors', id);
      break;

    case 'vault-delete':
      if (confirm("Unlink document?")) stateManager.delete('vault', id);
      break;

    // ---- AUTH ----
    case 'logout':
      authModule.logout();
      break;

    default:
      // Don’t fail silently—this helps catch missing wiring quickly.
      console.warn('Unhandled action:', action, 'target:', target);
      break;
  }
});

/**
 * 3. VIEW RENDERING ENGINE
 */
function refreshCurrentView(view, state) {
  const wrapper = document.getElementById('view-container-wrapper');
  if (wrapper) wrapper.scrollTop = 0;

  switch (view) {
    case 'dashboard':         dashboard.render(); break;
    case 'analytics':         analytics.render(); break;

    case 'deals':             deals.render(state); break;
    case 'properties':        properties.render(state); break;
    case 'projects':          projects.render(state); break;
    case 'investors':         investors.render(state); break;
    case 'contacts':          contacts.render(state); break;
    case 'tasks':             tasks.render(state); break;
    case 'llcs':              llcs.render(state); break;

    case 'activity':          activity.render(state); break;
    case 'calendar':          calendar.render(state); break;

    case 'deal-analyzer':     dealAnalyzer.render(state); break;
    case 'equity-waterfall':  equityWaterfall.render(state); break;
    case 'market-analysis':   marketAnalysis.render(state); break;

    case 'uploads':           uploads.render(state); break;

    case 'investor-portal':   investorPortal.render(); break;
    case 'public-portfolio':  publicPortfolio.render(); break;
    case 'vault':             vault.render(); break;
    case 'settings':          settingsModule.render(); break;

    default:
      dashboard.render();
      break;
  }
}

window.addEventListener('view-changed', (e) => {
  refreshCurrentView(e.detail.view, stateManager.get());
});
