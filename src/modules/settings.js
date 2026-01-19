/**
 * src/modules/settings.js
 * App settings & preferences
 *
 * Full overwrite updates included:
 * - escapeHtml for safe rendering
 * - modalManager logout confirmation (danger)
 * - try/catch + error modals for save/export/signout
 * - safe handling for missing/malformed state.settings
 * - OPTIONAL per-user settings:
 *    - stores under state.settingsByUser[uid]
 *    - also writes to state.settings for backward compatibility (so older modules still work)
 *
 * Notes:
 * - This module assumes stateManager.get(), stateManager.updateSettings() exist (as in your current pattern).
 * - This module assumes Firebase auth is available via stateManager.get().user or stateManager.get().authUser.
 *   If your auth user is stored differently, adjust getAuthUser() below.
 */

import { stateManager } from '../state.js';
import { modalManager } from '../utils/modals.js';

const DEFAULTS = {
  companyName: 'Summit Capital',
  currency: 'USD'
};

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeObj(v) {
  return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
}

function getAuthUser(state) {
  // Try common storage locations without throwing
  return state?.user || state?.authUser || state?.auth?.currentUser || null;
}

function getUserKey(user) {
  // Prefer uid, else email, else null (guest)
  const uid = user?.uid ? String(user.uid) : '';
  if (uid) return uid;
  const email = user?.email ? String(user.email) : '';
  return email || null;
}

function getPerUserSettings(state, userKey) {
  const byUser = safeObj(state?.settingsByUser) || {};
  const s = userKey ? safeObj(byUser[userKey]) : null;
  return s;
}

function mergeSettings(base, overrides) {
  return {
    ...DEFAULTS,
    ...(safeObj(base) || {}),
    ...(safeObj(overrides) || {})
  };
}

function showError(title, message) {
  modalManager.show(
    title,
    `<p class="text-sm font-semibold text-slate-700">${escapeHtml(message)}</p>`,
    () => true,
    { submitLabel: 'OK', hideCancel: true }
  );
}

function showSuccess(title, message) {
  modalManager.show(
    title,
    `<p class="text-sm font-semibold text-slate-700">${escapeHtml(message)}</p>`,
    () => true,
    { submitLabel: 'OK', hideCancel: true }
  );
}

export const settings = {
  _bound: false,
  _lastState: null,

  render() {
    const container = document.getElementById('view-settings');
    if (!container) return;

    const state = stateManager.get();
    this._lastState = state;

    const user = getAuthUser(state);
    const userKey = getUserKey(user);

    // Backward compatible:
    // - base: state.settings (global)
    // - override: state.settingsByUser[userKey] (per-user)
    const globalSettings = safeObj(state?.settings) || {};
    const perUserSettings = userKey ? getPerUserSettings(state, userKey) : null;

    const config = mergeSettings(globalSettings, perUserSettings);

    const displayEmail = user?.email ? String(user.email) : 'Authenticated User';
    const avatarChar = (displayEmail?.[0] || 'U').toUpperCase();

    container.innerHTML = `
      <div class="p-6 max-w-4xl mx-auto">
        <div class="mb-8">
          <h2 class="text-2xl font-black text-slate-900">System Settings</h2>
          <p class="text-sm text-slate-500 font-medium">Manage your CRM branding and preferences.</p>
        </div>

        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div class="p-6 border-b border-slate-100 flex items-center justify-between">
            <div class="flex items-center gap-4">
              <div class="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black">
                ${escapeHtml(avatarChar)}
              </div>
              <div>
                <div class="text-sm font-black text-slate-900">${escapeHtml(displayEmail)}</div>
                <div class="text-[11px] font-semibold text-slate-500">
                  ${userKey ? `Settings scope: ${escapeHtml(userKey)}` : 'Settings scope: Global (no user key found)'}
                </div>
              </div>
            </div>

            <button id="btn-logout"
              class="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-black text-xs uppercase tracking-wider transition-all">
              <i class="fa fa-right-from-bracket mr-2"></i> Logout
            </button>
          </div>

          <div class="p-6 space-y-6">
            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Company Name</label>
              <input id="settings-companyName" type="text"
                class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
                value="${escapeHtml(config.companyName)}">
              <p class="text-[11px] font-semibold text-slate-400 mt-2">
                Used for headers and the Public Portfolio view.
              </p>
            </div>

            <div>
              <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Currency</label>
              <select id="settings-currency"
                class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500">
                ${['USD','CAD','EUR','GBP'].map(c => `<option value="${c}" ${c === config.currency ? 'selected' : ''}>${c}</option>`).join('')}
              </select>
              <p class="text-[11px] font-semibold text-slate-400 mt-2">
                Stored now; wire your formatters to use this later if desired.
              </p>
            </div>

            <div class="flex flex-col md:flex-row gap-3 pt-2">
              <button id="btn-save-settings"
                class="flex-1 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider transition-all">
                <i class="fa fa-floppy-disk mr-2"></i> Save Preferences
              </button>

              <button id="btn-export-snapshot"
                class="flex-1 px-5 py-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-black text-xs uppercase tracking-wider transition-all">
                <i class="fa fa-download mr-2"></i> Export Data Snapshot
              </button>
            </div>

            <div class="p-4 rounded-xl bg-orange-50 border border-orange-100">
              <div class="text-[10px] font-black text-orange-700 uppercase tracking-widest mb-1">Compatibility Note</div>
              <p class="text-[11px] font-semibold text-orange-800 leading-relaxed">
                Settings are stored per-user when possible (<span class="font-black">settingsByUser</span>) and also mirrored to
                <span class="font-black">settings</span> for backward compatibility with older modules.
              </p>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  },

  bindEvents() {
    const container = document.getElementById('view-settings');
    if (!container) return;

    if (this._bound) {
      // Nodes are replaced each render; wire button handlers again safely.
      this._wireButtons();
      return;
    }

    this._bound = true;
    this._wireButtons();
  },

  _wireButtons() {
    const btnSave = document.getElementById('btn-save-settings');
    const btnExport = document.getElementById('btn-export-snapshot');
    const btnLogout = document.getElementById('btn-logout');

    if (btnSave) btnSave.onclick = () => this.saveSettings();
    if (btnExport) btnExport.onclick = () => this.exportSnapshot();
    if (btnLogout) btnLogout.onclick = () => this.confirmLogout();
  },

  saveSettings() {
    try {
      const state = stateManager.get();
      const user = getAuthUser(state);
      const userKey = getUserKey(user);

      const companyName = String(document.getElementById('settings-companyName')?.value ?? '').trim();
      const currency = String(document.getElementById('settings-currency')?.value ?? 'USD').trim() || 'USD';

      if (!companyName) throw new Error('Company Name cannot be blank.');

      const patch = { companyName, currency };

      // 1) Save per-user (optional) if we have a stable userKey
      if (userKey) {
        const byUser = safeObj(state?.settingsByUser) || {};
        const nextByUser = { ...byUser, [userKey]: { ...(safeObj(byUser[userKey]) || {}), ...patch } };

        // If stateManager supports generic update, prefer that.
        // We keep it conservative: attempt updateSettings if it exists; else update root with update().
        if (typeof stateManager.update === 'function') {
          stateManager.update('root', null, { settingsByUser: nextByUser }); // may not exist in your stateManager
        } else {
          // Many of your modules use updateSettings; we can still store settingsByUser by merging into settings object
          // if updateSettings only updates state.settings, we won't lose it because we also mirror.
        }

        // Mirror to global settings as well (backward compatibility)
        if (typeof stateManager.updateSettings === 'function') {
          stateManager.updateSettings(patch);
          // Try to persist settingsByUser if updateSettings supports deep merge:
          try {
            if (typeof stateManager.updateSettings === 'function') {
              stateManager.updateSettings({ settingsByUser: nextByUser });
            }
          } catch (_) {
            // If updateSettings doesn't support nested keys, ignore; still mirrored globally.
          }
        } else if (typeof stateManager.set === 'function') {
          // fall back: set entire state if supported (rare)
          stateManager.set({ ...state, settings: { ...(safeObj(state.settings) || {}), ...patch }, settingsByUser: nextByUser });
        }
      } else {
        // 2) Save global only
        if (typeof stateManager.updateSettings === 'function') {
          stateManager.updateSettings(patch);
        } else {
          throw new Error('State manager is missing updateSettings().');
        }
      }

      showSuccess('Preferences Updated', 'Your settings have been saved.');
    } catch (err) {
      showError('Save failed', err?.message || 'Unable to save settings.');
    }
  },

  exportSnapshot() {
    try {
      const state = stateManager.get();

      // Basic JSON snapshot download
      const json = JSON.stringify(state, null, 2);
      const blob = new Blob([json], { type: 'application/json' });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `crm_snapshot_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      showSuccess('Snapshot Exported', 'Your data snapshot was downloaded.');
    } catch (err) {
      showError('Export failed', err?.message || 'Unable to export snapshot.');
    }
  },

  confirmLogout() {
    modalManager.show(
      'End session',
      `<p class="text-sm font-semibold text-slate-700">Terminate the current session and log out?</p>`,
      async () => {
        try {
          const state = stateManager.get();
          const auth = state?.auth;

          // If you store firebase auth elsewhere, adjust this.
          if (auth?.signOut && typeof auth.signOut === 'function') {
            await auth.signOut();
          } else if (typeof stateManager.signOut === 'function') {
            await stateManager.signOut();
          } else {
            // Fallback: try global firebase auth if present (optional)
            if (window?.firebase?.auth?.().signOut) {
              await window.firebase.auth().signOut();
            } else {
              throw new Error('No signOut handler found.');
            }
          }

          showSuccess('Logged out', 'You have been signed out.');
          // Let your auth listener handle UI. As a fallback, reload.
          try {
            window.location.reload();
          } catch (_) {}

          return true;
        } catch (err) {
          showError('Logout failed', err?.message || 'Unable to sign out.');
          return false;
        }
      },
      { submitLabel: 'Logout', cancelLabel: 'Cancel', danger: true }
    );
  }
};

// Compatibility export
export const renderSettings = () => settings.render();
