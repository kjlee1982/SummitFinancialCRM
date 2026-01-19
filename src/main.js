/**
 * src/main.js
 * Central orchestrator: wires auth, router, state, and view modules.
 */

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

// IMPORTANT: avoid named-export mismatch by importing the whole module
import * as uploadsModule from './modules/uploads.js';

function getUploadsAPI() {
  // Support multiple export styles:
  // - export const uploads = {...}
  // - export const uploadManager = {...}
  // - export default {...}
  return (
    uploadsModule.uploads ||
    uploadsModule.uploadManager ||
    uploadsModule.default ||
    null
  );
}

/**
 * Sidebar helpers (mobile)
 */
function openSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  sidebar?.classList.remove('-translate-x-full');
  backdrop?.classList.remove('hidden');
}
function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  sidebar?.classList.add('-translate-x-full');
  backdrop?.classList.add('hidden');
}
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  const isHidden = sidebar.classList.contains('-translate-x-full');
  if (isHidden) openSidebar();
  else closeSidebar();
}

/**
 * 1) INITIALIZATION
 */
authModule.init();
router.init();

// Re-render current view when state changes
stateManager.subscribe((newState) => {
  refreshCurrentView(router.getCurrentView(), newState);
});

// First render (router will dispatch view-changed too, but this makes it resilient)
refreshCurrentView(router.getCurrentView(), stateManager.get());

/**
 * 2) GLOBAL EVENT DELEGATION
 */
document.addEventListener('click', async (e) => {
  const target = e.target.closest('[data-action]');
  if (!target) return;

  const action = target.dataset.action;
  const id = target.dataset.id;
  const state = stateManager.get();

  // Sidebar controls
  if (action === 'sidebar-toggle') {
    toggleSidebar();
    return;
  }
  if (action === 'sidebar-close') {
    closeSidebar();
    return;
  }

  // Navigation
  if (action === 'nav-link') {
    router.navigate(target.dataset.view);
    closeSidebar();
    return;
  }

  // Data actions
  switch (action) {
    case 'deal-add':     deals.showAddDealModal(); break;
    case 'property-add': properties.showAddPropertyModal(); break;
    case 'project-add':  projects.showAddProjectModal(); break;
    case 'investor-add': investors.showAddInvestorModal(); break;
    case 'task-add':     tasks.showAddTaskModal(); break;
    case 'contact-add':  contacts.showAddContactModal(); break;
    case 'llc-add':      llcs.showAddLLCModal(); break;
    case 'vault-add':    vault.showAddModal(); break;

    case 'task-toggle': {
      const t = Array.isArray(state.tasks) ? state.tasks.find(x => x.id === id) : null;
      if (!t) return;
      stateManager.update('tasks', id, { completed: !t.completed });
      break;
    }

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

    case 'logout':
      authModule.logout();
      break;
  }
});

/**
 * 3) VIEW RENDERING ENGINE
 */
function refreshCurrentView(view, state) {
  const wrapper = document.getElementById('view-container-wrapper');
  if (wrapper) wrapper.scrollTop = 0;

  switch (view) {
    case 'dashboard':         dashboard.render(state); break;
    case 'analytics':         analytics.render(state); break;

    case 'deals':             deals.render(state); break;
    case 'properties':        properties.render(state); break;
    case 'projects':          projects.render(state); break;

    case 'investors':         investors.render(state); break;
    case 'contacts':          contacts.render(state); break;
    case 'tasks':             tasks.render(state); break;
    case 'llcs':              llcs.render(state); break;

    case 'investor-portal':   investorPortal.render(state); break;
    case 'public-portfolio':  publicPortfolio.render(state); break;

    case 'vault':             vault.render(state); break;

    case 'uploads': {
      const uploads = getUploadsAPI();
      if (!uploads) {
        console.warn('Uploads module loaded, but no uploads API export found (uploads/uploadManager/default).');
        break;
      }
      // Support either .render(state) or .renderDropzone()
      if (typeof uploads.render === 'function') uploads.render(state);
      else if (typeof uploads.renderDropzone === 'function') uploads.renderDropzone();
      else console.warn('Uploads API found, but no render/renderDropzone method exists.');
      break;
    }

    case 'calendar':          calendar.render(state); break;
    case 'activity':          activity.render(state); break;

    case 'deal-analyzer':     dealAnalyzer.render(state); break;
    case 'equity-waterfall':  equityWaterfall.render(state); break;
    case 'market-analysis':   marketAnalysis.render(state); break;

    case 'settings':          settingsModule.render(state); break;

    default:
      dashboard.render(state);
  }
}

// Router -> view render
window.addEventListener('view-changed', (e) => {
  refreshCurrentView(e.detail.view, stateManager.get());
});
