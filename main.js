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

  // Always render with the latest state snapshot
  const st = state || stateManager.get();

  switch (view) {
    case 'dashboard': dashboard.render(st); break;
    case 'analytics': analytics.render(st); break;

    case 'deals': deals.render(st); break;
    case 'properties': properties.render(st); break;
    case 'projects': projects.render(st); break;

    case 'investor-portal': investorPortal.render(st); break;
    case 'investors': investors.render(st); break;
    case 'contacts': contacts.render(st); break;
    case 'public-portfolio': publicPortfolio.render(st); break;

    case 'deal-analyzer': {
      if (dealAnalyzer && typeof dealAnalyzer.render === 'function') {
        dealAnalyzer.render(st);
      } else {
        console.error('Deal Analyzer module is missing render().', dealAnalyzer);
      }
      break;
    }

    case 'market-analysis': marketAnalysis.render(st); break;

    case 'equity-waterfall': {
      if (equityWaterfall && typeof equityWaterfall.render === 'function') {
        equityWaterfall.render(st);
      } else {
        console.error('Equity Waterfall module is missing render().', equityWaterfall);
      }
      break;
    }

    case 'vault': vault.render(st); break;
    case 'uploads': uploads.render(st); break;
    case 'calendar': calendar.render(st); break;
    case 'activity': activity.render(st); break;

    case 'tasks': tasks.render(st); break;
    case 'llcs': llcs.render(st); break;
    case 'settings': settingsModule.render(st); break;

    default: dashboard.render(st); break;
  }
}



window.addEventListener('view-changed', (e) => {
  refreshCurrentView(e.detail.view, stateManager.get());
});

// Debug helpers (safe to leave in; remove later if you want)
window.getState = () => stateManager.get();
window.refreshCurrentView = (view = router.getCurrentView()) =>
  refreshCurrentView(view, stateManager.get());
