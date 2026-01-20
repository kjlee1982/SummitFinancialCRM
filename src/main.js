/**
 * src/main.js
 * Central command: auth + router + module render orchestration.
 */

import { stateManager } from './state.js';
import { router } from './router.js';
import { authModule } from './modules/auth.js';

import { dashboard } from './modules/dashboard.js';
import { analytics } from './modules/analytics.js';
import { settingsModule } from './modules/settings.js';
import { vault } from './modules/vault.js';

// IMPORTANT: GitHub Pages is case-sensitive — your filename is publicportfolio.js
import { publicPortfolio } from './modules/publicportfolio.js';

import { investorPortal } from './modules/investorPortal.js';

import { deals, showAddDealModal } from './modules/deals.js';
import { properties, showAddPropertyModal } from './modules/properties.js';
import { projects, showAddProjectModal } from './modules/projects.js';
import { investors, showAddInvestorModal } from './modules/investors.js';
import { contacts, showAddContactModal } from './modules/contacts.js';
import { tasks, showAddTaskModal } from './modules/tasks.js';
import { llcs, showAddLLCModal } from './modules/llcs.js';

import { uploads } from './modules/uploads.js';
import { calendar } from './modules/calendar.js';
import { activity } from './modules/activity.js';
import { dealAnalyzer } from './modules/deal-analyzer.js';
import { marketAnalysis } from './modules/market-analysis.js';
import { crexi } from './modules/crexi.js';
import { equityWaterfall } from './modules/equity-waterfall.js';

/**
 * Sidebar helpers
 */
function isMobile() {
  return window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
}

function openSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (!sidebar || !backdrop) return;
  sidebar.classList.remove('-translate-x-full');
  backdrop.classList.remove('hidden');
}

function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (!sidebar || !backdrop) return;
  sidebar.classList.add('-translate-x-full');
  backdrop.classList.add('hidden');
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  const isHidden = sidebar.classList.contains('-translate-x-full');
  if (isHidden) openSidebar();
  else closeSidebar();
}

/**
 * 1) Init
 */
authModule.init();
router.init();

stateManager.subscribe((newState) => {
  refreshCurrentView(router.getCurrentView(), newState);
});

/**
 * 2) Global event delegation
 */
document.addEventListener('click', (e) => {
  const target = e.target.closest('[data-action]');
  if (!target) return;

  const action = target.dataset.action;
  const id = target.dataset.id;
  const state = stateManager.get();

  // Sidebar / mobile UX
  if (action === 'sidebar-toggle') {
    toggleSidebar();
    return;
  }

  if (action === 'nav-link') {
    router.navigate(target.dataset.view);
    if (isMobile()) closeSidebar();
    return;
  }

  // Add actions
  switch (action) {
    case 'deal-add': showAddDealModal(); return;
    case 'property-add': showAddPropertyModal(); return;
    case 'project-add': showAddProjectModal(); return;
    case 'investor-add': showAddInvestorModal(); return;
    case 'contact-add': showAddContactModal(); return;
    case 'task-add': showAddTaskModal(); return;
    case 'vault-add': vault.showAddModal(); return;
    case 'llc-add': showAddLLCModal(); return;
    case 'logout': authModule.logout(); return;
  }

  // Example quick toggles (keep yours as needed)
  if (action === 'task-toggle') {
    const t = (state.tasks || []).find(x => x.id === id);
    if (!t) return;
    stateManager.update('tasks', id, { completed: !t.completed });
  }
});

// Click backdrop to close sidebar on mobile
document.getElementById('sidebarBackdrop')?.addEventListener('click', () => closeSidebar());

/**
 * 3) Rendering
 */
function refreshCurrentView(view, state) {
  const wrapper = document.getElementById('view-container-wrapper');
  if (wrapper) wrapper.scrollTop = 0;

  switch (view) {
    case 'dashboard': dashboard.render(); break;
    case 'analytics': analytics.render(); break;

    case 'deals': deals.render(); break;
    case 'properties': properties.render(); break;
    case 'projects': projects.render(); break;

    case 'investor-portal': investorPortal.render(); break;
    case 'investors': investors.render(); break;
    case 'contacts': contacts.render(); break;
    case 'public-portfolio': publicPortfolio.render(); break;

    case 'deal-analyzer': dealAnalyzer.render(); break;
    case 'market-analysis': marketAnalysis.render(); break;
    case 'crexi': crexi.render(); break;
    case 'equity-waterfall': equityWaterfall.render(); break;

    case 'vault': vault.render(); break;
    case 'uploads': uploads.render(); break;
    case 'calendar': calendar.render(); break;
    case 'activity': activity.render(); break;

    case 'tasks': tasks.render(); break;
    case 'llcs': llcs.render(); break;
    case 'settings': settingsModule.render(); break;

    default: dashboard.render(); break;
  }
}

window.addEventListener('view-changed', (e) => {
  refreshCurrentView(e.detail.view, stateManager.get());
});
