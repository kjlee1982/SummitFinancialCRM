/**
 * src/modules/auth.js
 * Handles user authentication, registration, and session state.
 */

import { auth } from '../firebase.js';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { stateManager } from '../state.js';
import { router } from '../router.js';

export const authModule = {
    /**
     * Initializes the auth listener. This should be called in main.js.
     */
    init() {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                console.log("👤 User Authenticated:", user.email);
                // Initialize state with the specific User ID
                await stateManager.init();
                // Redirect to dashboard if on the login page
                if (window.location.hash === '#login' || !window.location.hash) {
                    router.navigate('dashboard');
                }
            } else {
                console.log("🔒 No active session.");
                this.renderLogin();
            }
        });
    },

    /**
     * Renders the Login/Signup Interface
     */
    renderLogin() {
        const container = document.body; // Usually takes over the whole screen
        const loginOverlay = document.createElement('div');
        loginOverlay.id = 'auth-overlay';
        loginOverlay.className = 'fixed inset-0 bg-slate-900 z-[100] flex items-center justify-center p-6';
        
        loginOverlay.innerHTML = `
            <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
                <div class="text-center mb-8">
                    <div class="inline-flex items-center justify-center w-16 h-16 bg-orange-100 text-orange-600 rounded-full mb-4">
                        <i class="fa fa-mountain-sun text-3xl"></i>
                    </div>
                    <h2 class="text-2xl font-bold text-gray-800">Summit CRM</h2>
                    <p class="text-gray-500 text-sm">Real Estate Investment Management</p>
                </div>

                <form id="auth-form" class="space-y-4">
                    <div>
                        <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Email Address</label>
                        <input type="email" id="auth-email" required class="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none transition-all">
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Password</label>
                        <input type="password" id="auth-password" required class="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none transition-all">
                    </div>
                    <button type="submit" class="w-full bg-slate-900 text-white font-bold py-3 rounded-lg hover:bg-slate-800 transition-all shadow-lg">
                        Sign In
                    </button>
                </form>

                <div class="mt-6 text-center">
                    <button id="toggle-auth-mode" class="text-sm text-gray-500 hover:text-orange-600 transition-colors">
                        Need an account? <span class="font-bold">Register here</span>
                    </button>
                </div>
            </div>
        `;

        container.appendChild(loginOverlay);
        this.setupListeners(loginOverlay);
    },

    setupListeners(overlay) {
        const form = overlay.querySelector('#auth-form');
        form.onsubmit = async (e) => {
            e.preventDefault();
            const email = overlay.querySelector('#auth-email').value;
            const password = overlay.querySelector('#auth-password').value;

            try {
                await signInWithEmailAndPassword(auth, email, password);
                overlay.remove(); // Close auth UI on success
            } catch (error) {
                alert("Login Failed: " + error.message);
            }
        };
    },

    async logout() {
        if (confirm("Are you sure you want to log out?")) {
            await signOut(auth);
            localStorage.removeItem('summit_crm_data'); // Clear local cache for privacy
            window.location.reload();
        }
    }
};