/**
 * src/main.js
 * The Central Command: Links all modules and orchestrates the user experience.
 */

import { stateManager } from './state.js';
import { router } from './router.js';
import { authModule } from './modules/auth.js';

// --- UI MODULES ---
import { dashboard } from './modules/dashboard.js';
import { analytics } from './modules/analytics.js';
import { settingsModule } from './modules/settings.js';
import { vault } from './modules/vault.js';
import { publicPortfolio } from './modules/publicPortfolio.js';
import { investorPortal } from './modules/investorPortal.js';
import { renderDeals, showAddDealModal } from './modules/deals.js';
import { renderProperties, showAddPropertyModal } from './modules/properties.js';
import { renderProjects, showAddProjectModal } from './modules/projects.js';
import { renderInvestors, showAddInvestorModal } from './modules/investors.js';
import { renderContacts, showAddContactModal } from './modules/contacts.js';
import { renderTasks, showAddTaskModal } from './modules/tasks.js';
import { renderLLCs, showAddLLCModal } from './modules/llcs.js';

/**
 * Sidebar Controller (mobile drawer)
 */
let sidebarOpen = false;

function isDesktop() {
  return window.matchMedia('(min-width: 768px)').matches;
}

function setSidebar(open) {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (!sidebar || !backdrop) return;

  // On desktop, sidebar should always be visible and backdrop hidden
  if (isDesktop()) {
    sidebar.classList.remove('-translate-x-full');
    sidebar.classList.add('translate-x-0');
    backdrop.classList.add('hidden');
    sidebarOpen = false;
    return;
  }

  sidebarOpen = !!open;

  if (sidebarOpen) {
    sidebar.classList.remove('-translate-x-full');
    sidebar.classList.add('translate-x-0');
    backdrop.classList.remove('hidden');
  } else {
    sidebar.classList.add('-translate-x-full');
    sidebar.classList.remove('translate-x-0');
    backdrop.classList.add('hidden');
  }
}

function initSidebarUI() {
  const toggleBtn = document.getElementById('sidebarToggle');
  const backdrop = document.getElementById('sidebarBackdrop');

  // Start closed on mobile; always visible on desktop
  setSidebar(false);

  toggleBtn?.addEventListener('click', () => setSidebar(!sidebarOpen));
  backdrop?.addEventListener('click', () => setSidebar(false));

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') setSidebar(false);
  });

  // Keep sidebar state sane when resizing across breakpoint
  window.addEventListener('resize', () => {
    // Re-apply rules for current breakpoint
    setSidebar(sidebarOpen);
  });
}

/**
 * 1. INITIALIZATION
 */
authModule.init();
router.init();
initSidebarUI();

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

    // Auto-close mobile drawer after navigating
    setSidebar(false);
    return;
  }

  // Handle Data Actions
  switch (action) {
    case 'deal-add': showAddDealModal(); break;
    case 'property-add': showAddPropertyModal(); break;
    case 'project-add': showAddProjectModal(); break;
    case 'investor-add': showAddInvestorModal(); break;
    case 'contact-add': showAddContactModal(); break;
    case 'task-add': showAddTaskModal(); break;
    case 'vault-add': vault.showAddModal(); break;
    case 'llc-add': showAddLLCModal(); break;

    case 'task-toggle': {
      const task = (state.tasks || []).find(t => t.id === id);
      if (!task) break;
      stateManager.update('tasks', id, { completed: !task.completed });
      break;
    }

    case 'prop-delete':
      if (confirm('Permanently delete this asset?')) stateManager.delete('properties', id);
      break;

    case 'project-delete':
      if (confirm('Remove this project?')) stateManager.delete('projects', id);
      break;

    case 'investor-delete':
      if (confirm('Remove investor record?')) stateManager.delete('investors', id);
      break;

    case 'vault-delete':
      if (confirm('Unlink document?')) stateManager.delete('vault', id);
      break;

    case 'logout':
      authModule.logout();
      break;
  }
});

/**
 * 3. VIEW RENDERING ENGINE
 */
function refreshCurrentView(view, state) {
  // Reset scroll position
  const wrapper = document.getElementById('view-container-wrapper');
  if (wrapper) wrapper.scrollTop = 0;

  switch (view) {
    case 'dashboard':        dashboard.render(); break;
    case 'analytics':        analytics.render(); break;
    case 'deals':            renderDeals(state.deals); break;
    case 'properties':       renderProperties(state.properties); break;
    case 'projects':         renderProjects(state.projects); break;
    case 'investors':        renderInvestors(state.investors); break;
    case 'contacts':         renderContacts(state.contacts); break;
    case 'investor-portal':  investorPortal.render(); break;
    case 'public-portfolio': publicPortfolio.render(); break;
    case 'vault':            vault.render(); break;
    case 'tasks':            renderTasks(state.tasks); break;
    case 'llcs':             renderLLCs(state.llcs); break;
    case 'settings':         settingsModule.render(); break;
    default:                 dashboard.render();
  }
}

// Trigger refresh when the URL hash changes via the router
window.addEventListener('view-changed', (e) => {
  refreshCurrentView(e.detail.view, stateManager.get());
});
