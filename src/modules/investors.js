/**
 * src/modules/investors.js
 * Investor tracking and management (LP profiles).
 *
 * Full overwrite updates included:
 * - Safe array guards
 * - Escape user-entered output
 * - Event delegation (single handler on #view-investors)
 * - Delete uses modalManager (danger) instead of confirm()
 * - Add/Edit modals return true and validate required fields
 * - Portal integration:
 *    - sets sessionStorage.active_investor_id
 *    - navigates via router.navigate('investor-portal')
 * - Defensive initials rendering (no crash if name missing)
 * - deal_count no longer faked from invested amount; remains 0 unless you track allocations
 */

import { stateManager } from '../state.js';
import { router } from '../router.js';
import { formatters } from '../utils/formatters.js';
import { modalManager } from '../utils/modals.js';

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function toNumber(v, fallback = 0) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeRate(v, fallback) {
  // accepts 0.1 or 10 => 10%
  let r = toNumber(v, fallback);
  if (r > 1) r = r / 100;
  return r;
}

function initials(name) {
  const n = String(name ?? '').trim();
  if (!n) return '?';
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0].slice(0, 1) + parts[parts.length - 1].slice(0, 1)).toUpperCase();
}

function basicEmailOk(email) {
  const e = String(email ?? '').trim();
  if (!e) return true; // optional
  // Light validation: contains @ and dot after @
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function getInvestorFormHtml(inv = null) {
  const isEdit = !!inv;

  const name = escapeHtml(inv?.name || '');
  const email = escapeHtml(inv?.email || '');
  const phone = escapeHtml(inv?.phone || '');
  const type = escapeHtml(inv?.type || 'LP');
  const totalInvested = toNumber(inv?.total_invested, 0);
  const accredited = typeof inv?.accredited === 'boolean' ? inv.accredited : false;

  // Portal assumptions (optional fields consumed by investorPortal.js)
  const assumedStake = normalizeRate(inv?.assumed_stake, 0.10);
  const assumedYield = normalizeRate(inv?.assumed_yield, 0.075);

  return `
    <div class="grid grid-cols-2 gap-4">
      <div class="col-span-2">
        <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Investor Name</label>
        <input type="text" id="inv-name"
          class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
          placeholder="e.g. John Smith" value="${name}">
      </div>

      <div class="col-span-2">
        <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Email</label>
        <input type="email" id="inv-email"
          class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
          placeholder="john@email.com" value="${email}">
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Phone</label>
        <input type="tel" id="inv-phone"
          class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
          placeholder="555-0123" value="${phone}">
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Type</label>
        <select id="inv-type"
          class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none">
          ${['LP', 'GP', 'JV', 'KP'].map(t => `<option ${t === type ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('')}
        </select>
      </div>

      <div class="col-span-2">
        <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Total Invested</label>
        <input type="number" id="inv-total-invested"
          class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
          value="${totalInvested}" min="0" step="1000">
      </div>

      <div class="col-span-2 flex items-center gap-3">
        <input type="checkbox" id="inv-accredited" ${accredited ? 'checked' : ''} class="w-4 h-4">
        <label for="inv-accredited" class="text-sm font-semibold text-slate-700">Accredited Investor</label>
      </div>

      <div class="col-span-2">
        <div class="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2">Investor Portal Assumptions (optional)</div>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Assumed Stake (%)</label>
            <input type="number" id="inv-assumed-stake"
              class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
              value="${assumedStake * 100}" min="0" step="0.1">
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Assumed Yield (%)</label>
            <input type="number" id="inv-assumed-yield"
              class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
              value="${assumedYield * 100}" min="0" step="0.1">
          </div>
        </div>
        <p class="mt-2 text-[11px] font-semibold text-slate-400">
          Used by Investor Portal to estimate equity + annual distributions when deals are not explicitly linked.
        </p>
      </div>

      ${
        isEdit
          ? `<p class="col-span-2 text-[11px] font-semibold text-slate-400 mt-1">Edits sync automatically after saving.</p>`
          : ''
      }
    </div>
  `;
}

function readInvestorForm() {
  const name = String(document.getElementById('inv-name')?.value ?? '').trim();
  const email = String(document.getElementById('inv-email')?.value ?? '').trim();
  const phone = String(document.getElementById('inv-phone')?.value ?? '').trim();
  const type = String(document.getElementById('inv-type')?.value ?? 'LP').trim();
  const total_invested = toNumber(document.getElementById('inv-total-invested')?.value, 0);
  const accredited = !!document.getElementById('inv-accredited')?.checked;

  const assumed_stake_pct = toNumber(document.getElementById('inv-assumed-stake')?.value, 10);
  const assumed_yield_pct = toNumber(document.getElementById('inv-assumed-yield')?.value, 7.5);

  // Store as decimal rates for portal module (but accept percent input)
  const assumed_stake = normalizeRate(assumed_stake_pct, 0.10);
  const assumed_yield = normalizeRate(assumed_yield_pct, 0.075);

  return { name, email, phone, type, total_invested, accredited, assumed_stake, assumed_yield };
}

export const investors = {
  _bound: false,
  _lastState: null,

  render(state) {
    const container = document.getElementById('view-investors');
    if (!container) return;

    this._lastState = state;

    const investorList = Array.isArray(state?.investors) ? state.investors : [];
    const totalAUM = investorList.reduce((sum, inv) => sum + toNumber(inv?.total_invested, 0), 0);

    container.innerHTML = `
      <div class="p-6">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 class="text-2xl font-bold text-gray-900">Investor Tracker</h2>
            <p class="text-sm text-gray-500 font-medium">
              ${investorList.length} investor profiles • Total Invested: ${formatters.dollars(totalAUM)}
            </p>
          </div>

          <button id="add-investor-btn"
            class="bg-slate-900 text-white px-5 py-2.5 rounded-lg hover:bg-slate-800 font-bold shadow-sm transition-all flex items-center text-sm">
            <i class="fa fa-plus mr-2"></i>Add Investor
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
          ${this.renderInvestorCards(investorList)}
        </div>
      </div>
    `;

    this.bindEvents();
  },

  renderInvestorCards(list) {
    if (!list || list.length === 0) {
      return `
        <div class="col-span-full py-20 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-white">
          <i class="fa fa-users text-4xl mb-3 opacity-20"></i>
          <p>No investors yet. Add your first LP profile.</p>
        </div>
      `;
    }

    return list
      .map((inv) => {
        const name = escapeHtml(inv?.name || 'Unnamed Investor');
        const email = escapeHtml(inv?.email || '');
        const phone = escapeHtml(inv?.phone || '');
        const type = escapeHtml(inv?.type || 'LP');
        const invested = toNumber(inv?.total_invested, 0);
        const acc = typeof inv?.accredited === 'boolean' ? inv.accredited : false;
        const invId = escapeHtml(inv?.id);

        return `
          <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow group">
            <div class="p-5">
              <div class="flex justify-between items-start mb-4">
                <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${this.getInvestorTypeClass(type)}">
                  ${type}
                </span>

                <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button data-action="investor-open-portal" data-id="${invId}"
                    class="text-gray-400 hover:text-slate-700" title="Open Investor Portal">
                    <i class="fa fa-door-open text-xs"></i>
                  </button>

                  <button data-action="investor-edit" data-id="${invId}"
                    class="text-gray-400 hover:text-slate-700" title="Edit">
                    <i class="fa fa-pen text-xs"></i>
                  </button>

                  <button data-action="investor-delete" data-id="${invId}"
                    class="text-gray-400 hover:text-red-500" title="Delete">
                    <i class="fa fa-trash text-xs"></i>
                  </button>
                </div>
              </div>

              <div class="text-center mb-4">
                <div class="w-16 h-16 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xl font-bold mx-auto mb-2 border-2 border-white shadow-sm">
                  ${escapeHtml(initials(inv?.name))}
                </div>
                <h3 class="font-bold text-gray-900 text-lg">${name}</h3>
                <p class="text-xs text-gray-500 font-medium">${email || (phone ? phone : '—')}</p>

                ${
                  acc
                    ? `<div class="mt-2 inline-flex items-center gap-2 text-[10px] font-black px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                        <i class="fa fa-check-circle"></i> ACCREDITED
                       </div>`
                    : ''
                }
              </div>

              <div class="space-y-2 pt-4 border-t border-gray-50">
                <div class="flex items-center justify-between text-sm">
                  <span class="text-gray-500 font-semibold">Total Invested</span>
                  <span class="font-black text-slate-900">${formatters.dollars(invested)}</span>
                </div>
              </div>
            </div>

            <div class="bg-gray-50 px-5 py-3 flex gap-2">
              <button data-action="investor-open-portal" data-id="${invId}"
                class="flex-grow text-center bg-slate-900 text-white py-2 rounded text-xs font-black hover:bg-slate-800 transition-colors">
                Open Portal
              </button>
              <button data-action="investor-edit" data-id="${invId}"
                class="flex-grow text-center bg-white border border-gray-200 py-2 rounded text-xs font-black text-gray-600 hover:bg-gray-100 transition-colors">
                Edit
              </button>
            </div>
          </div>
        `;
      })
      .join('');
  },

  bindEvents() {
    const container = document.getElementById('view-investors');
    if (!container) return;

    // Add button (rebuilt each render)
    const addBtn = document.getElementById('add-investor-btn');
    if (addBtn) addBtn.onclick = () => this.showAddInvestorModal();

    // Delegated actions (bind once)
    if (this._bound) return;
    this._bound = true;

    container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const id = btn.dataset.id;

      if (action === 'investor-delete') {
        this.confirmDelete(id);
        return;
      }

      if (action === 'investor-edit') {
        this.openEditById(id);
        return;
      }

      if (action === 'investor-open-portal') {
        this.openPortalForInvestor(id);
      }
    });
  },

  confirmDelete(id) {
    const list = Array.isArray(this._lastState?.investors) ? this._lastState.investors : [];
    const inv = list.find((x) => String(x?.id) === String(id));
    const label = inv?.name ? `“${inv.name}”` : 'this investor';

    modalManager.show(
      'Delete investor',
      `<p class="text-sm font-semibold text-slate-700">Delete ${escapeHtml(label)}? This cannot be undone.</p>`,
      () => {
        stateManager.delete('investors', id);
        return true;
      },
      { submitLabel: 'Delete', cancelLabel: 'Cancel', danger: true }
    );
  },

  openEditById(id) {
    const list = Array.isArray(this._lastState?.investors) ? this._lastState.investors : [];
    const inv = list.find((x) => String(x?.id) === String(id));

    if (!inv) {
      modalManager.show(
        'Investor not found',
        `<p class="text-sm font-semibold text-slate-700">That investor could not be found. It may have been deleted or not synced yet.</p>`,
        () => true,
        { submitLabel: 'Close', hideCancel: true }
      );
      return;
    }

    this.showEditInvestorModal(inv);
  },

  openPortalForInvestor(id) {
    try {
      sessionStorage.setItem('active_investor_id', String(id));
    } catch (_) {}

    // Also dispatch an event so other parts can react if desired
    window.dispatchEvent(new CustomEvent('investors:open-portal', { detail: { investorId: String(id) } }));

    router.navigate('investor-portal');
  },

  showAddInvestorModal() {
    const formHtml = getInvestorFormHtml(null);

    modalManager.show(
      'Add Investor',
      formHtml,
      () => {
        const data = readInvestorForm();

        if (!data.name) throw new Error('Investor name is required.');
        if (!basicEmailOk(data.email)) throw new Error('Please enter a valid email address.');

        // Do not fake deal_count. Keep 0 unless you implement allocations.
        data.deal_count = 0;

        data.created_at = new Date().toISOString();
        data.createdAt = data.created_at;

        stateManager.add('investors', data);
        return true;
      },
      { submitLabel: 'Add', cancelLabel: 'Cancel' }
    );
  },

  showEditInvestorModal(inv) {
    const formHtml = getInvestorFormHtml(inv);

    modalManager.show(
      'Edit Investor',
      formHtml,
      () => {
        const patch = readInvestorForm();

        if (!patch.name) throw new Error('Investor name is required.');
        if (!basicEmailOk(patch.email)) throw new Error('Please enter a valid email address.');

        patch.updated_at = new Date().toISOString();
        patch.updatedAt = patch.updated_at;

        // Keep deal_count unchanged unless explicitly tracked elsewhere
        delete patch.deal_count;

        stateManager.update('investors', inv.id, patch);
        return true;
      },
      { submitLabel: 'Save', cancelLabel: 'Cancel' }
    );
  },

  getInvestorTypeClass(type) {
    const t = String(type ?? '').toUpperCase();
    if (t === 'GP') return 'bg-indigo-50 text-indigo-600';
    if (t === 'JV') return 'bg-amber-50 text-amber-700';
    return 'bg-emerald-50 text-emerald-700'; // LP
  }
};

// Compatibility exports (if main.js imports these named funcs)
export const renderInvestors = (state) => investors.render(state);
export const showAddInvestorModal = () => investors.showAddInvestorModal();
