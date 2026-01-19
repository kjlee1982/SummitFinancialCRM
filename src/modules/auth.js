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
  isRegistering: false,

  init() {
    onAuthStateChanged(auth, async (user) => {
      const existingOverlay = document.getElementById('auth-overlay');

      if (user) {
        console.log("👤 User Authenticated:", user.email);
        if (existingOverlay) existingOverlay.remove();

        await stateManager.init();

        if (window.location.hash === '#login' || !window.location.hash || window.location.hash === '#') {
          router.navigate('dashboard');
        }
      } else {
        console.log("🔒 No active session.");
        if (!existingOverlay) this.renderLogin();
      }
    });
  },

  renderLogin() {
    if (document.getElementById('auth-overlay')) return;

    const container = document.body;
    const loginOverlay = document.createElement('div');
    loginOverlay.id = 'auth-overlay';
    loginOverlay.className = 'fixed inset-0 bg-slate-900 z-[100] flex items-center justify-center p-6';

    this.updateOverlayHTML(loginOverlay);
    container.appendChild(loginOverlay);
    this.setupListeners(loginOverlay);
  },

  updateOverlayHTML(overlay) {
    overlay.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 transform transition-all">
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-16 h-16 bg-orange-100 text-orange-600 rounded-full mb-4">
            <i class="fa fa-mountain-sun text-3xl"></i>
          </div>
          <h2 class="text-2xl font-bold text-gray-800">Summit CRM</h2>
          <p class="text-gray-500 text-sm">${this.isRegistering ? 'Create your professional account' : 'Real Estate Investment Management'}</p>
        </div>

        <form id="auth-form" class="space-y-4">
          <div>
            <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Email Address</label>
            <input type="email" id="auth-email" required class="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none transition-all">
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Password</label>
            <input type="password" id="auth-password" required minlength="6" class="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none transition-all">
          </div>
          <button type="submit" id="auth-submit-btn" class="w-full bg-slate-900 text-white font-bold py-3 rounded-lg hover:bg-slate-800 transition-all shadow-lg flex items-center justify-center">
            ${this.isRegistering ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <div class="mt-6 text-center">
          <button id="toggle-auth-mode" class="text-sm text-gray-500 hover:text-orange-600 transition-colors">
            ${this.isRegistering ? 'Already have an account? <span class="font-bold">Sign in</span>' : 'Need an account? <span class="font-bold">Register here</span>'}
          </button>
        </div>
      </div>
    `;
  },

  setupListeners(overlay) {
    const form = overlay.querySelector('#auth-form');
    const toggleBtn = overlay.querySelector('#toggle-auth-mode');

    toggleBtn.onclick = () => {
      this.isRegistering = !this.isRegistering;
      this.updateOverlayHTML(overlay);
      this.setupListeners(overlay);
    };

    form.onsubmit = async (e) => {
      e.preventDefault();
      const email = overlay.querySelector('#auth-email').value;
      const password = overlay.querySelector('#auth-password').value;
      const submitBtn = overlay.querySelector('#auth-submit-btn');

      const originalText = submitBtn.innerText;
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<i class="fa fa-circle-notch fa-spin mr-2"></i> Processing...`;

      try {
        if (this.isRegistering) {
          await createUserWithEmailAndPassword(auth, email, password);
        } else {
          await signInWithEmailAndPassword(auth, email, password);
        }
      } catch (error) {
        console.error("Auth Error:", error.code);
        alert(this.getFriendlyError(error.code));
        submitBtn.disabled = false;
        submitBtn.innerText = originalText;
      }
    };
  },

  getFriendlyError(code) {
    switch (code) {
      case 'auth/invalid-credential': return 'Invalid email or password.';
      case 'auth/email-already-in-use': return 'That email is already registered.';
      case 'auth/weak-password': return 'Password should be at least 6 characters.';
      default: return 'Authentication failed. Please try again.';
    }
  },

  async logout() {
    await signOut(auth);
    localStorage.removeItem('summit_crm_data');
    window.location.reload();
  }
};

// Backward-compatible alias (fixes “does not provide export named authManager”)
export const authManager = authModule;
