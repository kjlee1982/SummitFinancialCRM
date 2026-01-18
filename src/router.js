/**
 * src/router.js
 * Manages view states and browser history.
 */

const views = [
    'dashboard', 'analytics', 'deals', 'properties', 
    'projects', 'investors', 'vault', 'contacts', 
    'tasks', 'llcs', 'settings', 'public-portfolio', 'investor-portal'
];

let currentView = 'dashboard';

export const router = {
    init() {
        // Listen for back/forward browser buttons
        window.addEventListener('popstate', () => {
            const hash = window.location.hash.replace('#', '');
            if (views.includes(hash)) {
                this.navigate(hash, false);
            }
        });

        // Initial route check
        const initialHash = window.location.hash.replace('#', '');
        if (views.includes(initialHash)) {
            currentView = initialHash;
        }
    },

    navigate(view, pushState = true) {
        if (!views.includes(view)) return;
        
        currentView = view;
        
        // Update URL
        if (pushState) {
            window.location.hash = view;
        }

        // Hide all views
        document.querySelectorAll('.view-container').forEach(el => {
            el.classList.add('hidden');
        });

        // Show target view
        const target = document.getElementById(`view-${view}`);
        if (target) {
            target.classList.remove('hidden');
        }

        // Dispatch global event for main.js to re-render
        window.dispatchEvent(new CustomEvent('view-changed', { detail: { view } }));
    },

    getCurrentView() {
        return currentView;
    }
};