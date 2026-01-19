/**
 * src/main.js
 * The Central Command: Links all modules and orchestrates the user experience.
 */
 
import { db } from './firebase.js';
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
 * 1. INITIALIZATION
 */
authModule.init();
router.init();

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
        document.getElementById('sidebar')?.classList.add('-translate-x-full'); 
        return;
    }

    // Handle Data Actions - Updated to call methods from objects
    switch (action) {
        case 'deal-add':     deals.showAddDealModal(); break;
        case 'property-add': properties.showAddPropertyModal(); break;
        case 'project-add':  projects.showAddProjectModal(); break;
        case 'investor-add': investors.showAddInvestorModal(); break;
        case 'task-add':     tasks.showAddTaskModal(); break;
        case 'contact-add':  contacts.showAddContactModal(); break;
        case 'llc-add':      llcs.showAddLLCModal(); break;
        case 'vault-add':    vault.showAddModal(); break;

        case 'task-toggle':
            const task = state.tasks.find(t => t.id === id);
            stateManager.update('tasks', id, { completed: !task.completed });
            break;

        case 'prop-delete': if(confirm("Permanently delete this asset?")) stateManager.delete('properties', id); break;
        case 'project-delete': if(confirm("Remove this project?")) stateManager.delete('projects', id); break;
        case 'investor-delete': if(confirm("Remove investor record?")) stateManager.delete('investors', id); break;
        case 'vault-delete': if(confirm("Unlink document?")) stateManager.delete('vault', id); break;

        case 'logout': authModule.logout(); break;
    }
});

/**
 * 3. VIEW RENDERING ENGINE
 */
function refreshCurrentView(view, state) {
    const wrapper = document.getElementById('view-container-wrapper');
    if (wrapper) wrapper.scrollTop = 0;

    switch (view) {
        case 'dashboard':       dashboard.render(); break;
        case 'analytics':       analytics.render(); break;
        case 'deals':           deals.render(state); break;
        case 'properties':      properties.render(state); break;
        case 'projects':        projects.render(state); break;
        case 'investors':       investors.render(state); break;
        case 'contacts':        contacts.render(state); break;
        case 'tasks':           tasks.render(state); break;
        case 'llcs':            llcs.render(state); break;
        case 'investor-portal': investorPortal.render(); break;
        case 'public-portfolio': publicPortfolio.render(); break;
        case 'vault':           vault.render(); break;
        case 'settings':        settingsModule.render(); break;
        default:                dashboard.render();
    }
}

window.addEventListener('view-changed', (e) => {
    refreshCurrentView(e.detail.view, stateManager.get());
});