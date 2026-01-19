/**
 * src/modules/auth.js
 * Handles user authentication, registration, and session state.
 */

import { auth } from '../firebase.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { stateManager } from '../state.js';
import { router } from '../router.js';
import { modalManager } from '../utils/modals.js';

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function showMessage(title, message, { tone = 'info', buttonLabel = 'OK' } = {}) {
  const icon =
    tone === 'error'
      ? `<i class="fa fa-triangle-exclamation text-red-600 text-2xl"></i>`
      : tone === 'success'
        ? `<i class="fa fa-circle-check text-emerald-600 text-2xl"></i>`
        : `<i class="fa fa-circle-info text-slate-600 text-2xl"></i>`;

  modalManager.show(
    title,
    `
      <div class="flex items-start gap-3">
        <div class="mt-0.5">${icon}</div>
        <div class="text-sm font-semibold text-slate-700 leading-relaxed">
          ${escapeHtml(message)}
        </div>
      </div>
    `,
    () => true,
    {
      submitLabel: buttonLabel,
      hideCancel: true
    }
  );
}

function showConfirm(title, message, { confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false } = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (val) => {
      if (settled) return;
      settled = true;
      resolve(val);
    };

    // Confirm resolves true
    modalManager.show(
      title,
      `<div class="text-sm font-semibold text-slate-700 leading-relaxed">${escapeHtml(message)}</div>`,
      () => {
        settle(true);
        return true; // allow close
      },
      {
        submitLabel: confirmLabel,
        cancelLabel,
        danger
      }
    );

    // Cancel / close / backdrop resolves false
    const cancelBtn = document.getElementById('modal-cancel');
    const closeBtn = document.getElementById('modal-close');
    const backdrop = document.getElementById('modal-backdrop');

    cancelBtn?.addEventListener('click', () => settle(false), { once: true });
    closeBtn?.addEventListener('click', () => settle(false), { once: true });

    // Backdrop close
    backdrop?.addEventListener(
      'click',
      (e) => {
        if (e.target === backdrop) settle(false);
      },
      { once: true }
    );
  });
}

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

    const overlay = document.createElement('div');
    overlay.id = 'auth-overlay';
    overlay.className = 'fixed inset-0 bg-slate-900 z-[100] flex items-center justify-center p-6';

    this.updateOverlayHTML(overlay);
    document.body.appendChild(overlay);
    this.setupListeners(overlay);
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
            <input type="email" id="auth-email" required
              class="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none transition-all">
          </div>

          <div>
            <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Password</label>
            <div class="relative">
              <input type="password" id="auth-password" required minlength="6"
                class="w-full pr-12 px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-orange-500 outline-none transition-all">
              <button type="button" id="auth-toggle-password"
                class="absolute inset-y-0 right-0 px-3 text-gray-400 hover:text-gray-700 transition-colors"
                aria-label="Show password">
                <i class="fa fa-eye"></i>
              </button>
            </div>

            ${
              this.isRegistering
                ? ''
                : `
                  <div class="mt-2 flex justify-end">
                    <button type="button" id="auth-forgot-password"
                      class="text-xs font-bold text-slate-500 hover:text-orange-600 transition-colors">
                      Forgot password?
                    </button>
                  </div>
                `
            }
          </div>

          <button type="submit" id="auth-submit-btn"
            class="w-full bg-slate-900 text-white font-bold py-3 rounded-lg hover:bg-slate-800 transition-all shadow-lg flex items-center justify-center">
            <span id="auth-submit-label">${this.isRegistering ? 'Create Account' : 'Sign In'}</span>
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
    const togglePwBtn = overlay.querySelector('#auth-toggle-password');
    const forgotBtn = overlay.querySelector('#auth-forgot-password');

    toggleBtn.onclick = () => {
      this.isRegistering = !this.isRegistering;
      this.updateOverlayHTML(overlay);
      this.setupListeners(overlay);
    };

    togglePwBtn.onclick = () => {
      const pw = overlay.querySelector('#auth-password');
      if (!pw) return;

      const isHidden = pw.type === 'password';
      pw.type = isHidden ? 'text' : 'password';

      togglePwBtn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
      togglePwBtn.innerHTML = isHidden ? `<i class="fa fa-eye-slash"></i>` : `<i class="fa fa-eye"></i>`;
    };

    if (forgotBtn) {
      forgotBtn.onclick = async () => {
        const emailEl = overlay.querySelector('#auth-email');
        const email = emailEl?.value?.trim() || '';

        if (!email) {
          showMessage('Password reset', 'Enter your email address first, then click “Forgot password?”.', { tone: 'info' });
          emailEl?.focus();
          return;
        }

        try {
          await sendPasswordResetEmail(auth, email);
          showMessage('Password reset sent', 'Check your inbox (and spam folder) for the reset email.', { tone: 'success' });
        } catch (error) {
          console.error('Password reset error:', error);
          showMessage('Password reset failed', this.getFriendlyResetError(error.code), { tone: 'error' });
        }
      };
    }

    form.onsubmit = async (e) => {
      e.preventDefault();

      const email = overlay.querySelector('#auth-email')?.value || '';
      const password = overlay.querySelector('#auth-password')?.value || '';
      const submitBtn = overlay.querySelector('#auth-submit-btn');
      const submitLabel = overlay.querySelector('#auth-submit-label');

      if (!submitBtn || !submitLabel) return;

      const originalLabel = submitLabel.textContent;
      submitBtn.disabled = true;
      submitLabel.innerHTML = `<i class="fa fa-circle-notch fa-spin mr-2"></i> Processing...`;

      try {
        if (this.isRegistering) {
          await createUserWithEmailAndPassword(auth, email, password);
          showMessage('Account created', 'Your account was created successfully. You are now signed in.', { tone: 'success' });
        } else {
          await signInWithEmailAndPassword(auth, email, password);
        }
        // onAuthStateChanged will remove overlay + init state
      } catch (error) {
        console.error("Auth Error:", error.code || error);
        showMessage('Authentication failed', this.getFriendlyError(error.code), { tone: 'error' });

        submitBtn.disabled = false;
        submitLabel.textContent = originalLabel;
      }
    };
  },

  getFriendlyError(code) {
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Invalid email or password.';
      case 'auth/invalid-email':
        return 'That email address is not valid.';
      case 'auth/email-already-in-use':
        return 'That email is already registered.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters.';
      case 'auth/user-disabled':
        return 'This user account has been disabled.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please wait a bit and try again.';
      case 'auth/network-request-failed':
        return 'Network error. Check your connection and try again.';
      default:
        return 'Authentication failed. Please try again.';
    }
  },

  getFriendlyResetError(code) {
    switch (code) {
      case 'auth/invalid-email':
        return 'That email address is not valid.';
      case 'auth/user-not-found':
        // Keep generic to avoid confirming account existence
        return 'If an account exists for that email, a reset email will be sent.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please wait a bit and try again.';
      case 'auth/network-request-failed':
        return 'Network error. Check your connection and try again.';
      default:
        return 'Could not send reset email. Please try again.';
    }
  },

  async logout() {
    const ok = await showConfirm('Log out', 'Are you sure you want to log out?', {
      confirmLabel: 'Log out',
      cancelLabel: 'Cancel',
      danger: true
    });

    if (!ok) return;

    try {
      await signOut(auth);
      router.navigate('dashboard', true);
      // onAuthStateChanged will show login overlay
    } catch (e) {
      console.error('Logout failed:', e);
      showMessage('Logout failed', 'Please try again.', { tone: 'error' });
    }
  }
};
