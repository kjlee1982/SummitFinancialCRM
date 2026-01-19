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

// NOTE: GitHub Pages is case-sensitive. Ensure this matches the actual filename in /src/modules.
// Your screenshot shows `publicportfolio.js` (lowercase p), so import must match exactly:
import { publicPortfolio } from './modules/publicportfolio.js';

import { investorPortal } from './modules/investorPortal.js';
import { renderDeals, showAddDealModal } from './modules/deals.js';
import { renderProperties, showAddPropertyModal } from './modules/properties.js';
import { renderProjects, showAddProjectModal } from './modules/projects.js';
import { renderInvestors, showAddInvestorModal } from './modules/investors.js';
import { renderContacts, showAddContactModal } from './modules/contacts.js';
import { renderTasks, showAddTaskModal } from './modules/tasks.js';
import { renderLLCs, showAddLLCModal } from './modules/llcs.js';

/**
 * 1. INITIALIZATION
 */
authModule.init();
router.init();

// Mobile sidebar toggle/backdrop behavior (index.html uses #sidebarToggle + #sidebarBackdrop)
bindSidebarControls();

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
    closeSidebar(); // Auto-close mobile menu
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
      const task = state.tasks.find(t => t.id === id);
      if (!task) return;
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
 * Mobile sidebar helpers
 */
let _sidebarBound = false;
function bindSidebarControls() {
  if (_sidebarBound) return;
  _sidebarBound = true;

  const toggleBtn = document.getElementById('sidebarToggle');
  const backdrop = document.getElementById('sidebarBackdrop');

  toggleBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleSidebar();
  });

  backdrop?.addEventListener('click', (e) => {
    e.preventDefault();
    closeSidebar();
  });

  // ESC closes on mobile
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSidebar();
  });

  // If user resizes to desktop, ensure sidebar is visible and backdrop hidden
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) {
      openSidebar(true);
    } else {
      // On mobile default to closed on resize to small
      closeSidebar(true);
    }
  });

  // Initial state: desktop open, mobile closed
  if (window.innerWidth >= 768) openSidebar(true);
  else closeSidebar(true);
}

function openSidebar(silent = false) {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');

  sidebar?.classList.remove('-translate-x-full');

  // Backdrop only used on mobile
  if (window.innerWidth < 768) backdrop?.classList.remove('hidden');
  else backdrop?.classList.add('hidden');

  if (!silent) sidebar?.setAttribute('aria-expanded', 'true');
}

function closeSidebar(silent = false) {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');

  if (window.innerWidth < 768) {
    sidebar?.classList.add('-translate-x-full');
    backdrop?.classList.add('hidden');
  } else {
    // On desktop we don't auto-collapse
    sidebar?.classList.remove('-translate-x-full');
    backdrop?.classList.add('hidden');
  }

  if (!silent) sidebar?.setAttribute('aria-expanded', 'false');
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;

  if (sidebar.classList.contains('-translate-x-full')) openSidebar();
  else closeSidebar();
}

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
