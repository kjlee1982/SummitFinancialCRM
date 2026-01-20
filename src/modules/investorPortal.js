/**
 * src/modules/investorPortal.js
 * Investor Portal view (LP-facing snapshot)
 *
 * Full overwrite updates included:
 * - Safe array guards (no runtime crashes when state arrays missing)
 * - Active investor selection:
 *    1) state.session?.investor_id
 *    2) sessionStorage.active_investor_id
 *    3) first investor (fallback)
 * - Improved investor-to-property matching:
 *    - Supports tags in property.notes: "investors: John Smith | Mary Jones"
 *    - Supports optional property.investors array (future-proof)
 *    - Falls back to legacy fuzzy matching (name in notes/owning_llc)
 * - Escapes all user-controlled output (prevents layout break / injection)
 * - Accredited badge is conditional (uses activeInvestor.accredited if present)
 * - Stake + yield configurable per investor (assumed_stake/assumed_yield), with defaults
 * - Buttons wired: open modal “Coming soon” and dispatch events for future integrations
 */

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
  // accepts 0.075 or 7.5 -> 7.5%
  let r = toNumber(v, fallback);
  if (r > 1) r = r / 100;
  return r;
}

function getFirstName(fullName) {
  const n = String(fullName ?? '').trim();
  if (!n) return 'Investor';
  return n.split(/\s+/)[0] || 'Investor';
}

function getActiveInvestorId(state) {
  const fromState = state?.session?.investor_id;
  if (fromState !== undefined && fromState !== null && String(fromState).trim() !== '') {
    return String(fromState);
  }

  try {
    const fromStorage = sessionStorage.getItem('active_investor_id');
    if (fromStorage) return String(fromStorage);
  } catch (_) {
    // ignore storage failures
  }

  return null;
}

function parseInvestorTags(notesText) {
  // Supports: "investors: John Smith | Mary Jones"
  const notes = String(notesText ?? '');
  const m = notes.match(/investors\s*:\s*([^\n\r]+)/i);
  if (!m) return [];
  return m[1]
    .split('|')
    .map((x) => x.trim())
    .filter(Boolean);
}

function includesNameToken(list, name) {
  const n = String(name ?? '').trim().toLowerCase();
  if (!n) return false;
  return list.some((x) => String(x ?? '').trim().toLowerCase() === n);
}

function fuzzyIncludes(hay, needle) {
  const h = String(hay ?? '').toLowerCase();
  const n = String(needle ?? '').toLowerCase();
  if (!h || !n) return false;
  return h.includes(n);
}

function showComingSoon(title, body, extra = '') {
  modalManager.show(
    title,
    `
      <div class="space-y-3">
        <p class="text-sm font-semibold text-slate-700">${escapeHtml(body)}</p>
        ${extra ? `<p class="text-xs font-semibold text-slate-500">${escapeHtml(extra)}</p>` : ''}
        <p class="text-[11px] font-semibold text-slate-400">
          Tip: This is wired to dispatch an event so you can plug in uploads / statements later.
        </p>
      </div>
    `,
    () => true,
    { submitLabel: 'OK', hideCancel: true }
  );
}

export const investorPortal = {
  _bound: false,
  _lastState: null,

  render(state) {
    const container = document.getElementById('view-investor-portal');
    if (!container) return;

    this._lastState = state;

    const properties = Array.isArray(state?.properties) ? state.properties : [];
    const investors = Array.isArray(state?.investors) ? state.investors : [];

    if (investors.length === 0) {
      container.innerHTML = `
        <div class="p-10">
          <div class="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm text-center">
            <div class="text-4xl opacity-20 mb-3"><i class="fa fa-user-circle"></i></div>
            <div class="text-lg font-black text-slate-900">No investors found</div>
            <div class="text-sm font-semibold text-slate-500 mt-1">
              Add investors in the Investors tab to populate the Investor Portal.
            </div>
          </div>
        </div>
      `;
      return;
    }

    const requestedId = getActiveInvestorId(state);
    const activeInvestor =
      (requestedId ? investors.find((i) => String(i?.id) === String(requestedId)) : null) || investors[0];

    // Persist selection for future navigation consistency
    try {
      if (activeInvestor?.id != null) sessionStorage.setItem('active_investor_id', String(activeInvestor.id));
    } catch (_) {}

    const firstName = getFirstName(activeInvestor?.name);

    // Per-investor configurable assumptions (fallback defaults)
    const assumedStake = normalizeRate(activeInvestor?.assumed_stake, 0.10);
    const assumedYield = normalizeRate(activeInvestor?.assumed_yield, 0.075);

    // Compute "investments" by matching investor to properties:
    // 1) property.investors array contains exact name or id
    // 2) property.notes includes "investors:" tags
    // 3) fallback fuzzy matching (legacy)
    const investorName = String(activeInvestor?.name || '').trim();
    const investorId = String(activeInvestor?.id ?? '').trim();

    const investments = properties.filter((p) => {
      // (1) property.investors array (future-proof)
      if (Array.isArray(p?.investors)) {
        // allow either ids or names
        const asStrings = p.investors.map((x) => String(x ?? '').trim()).filter(Boolean);
        if (investorId && asStrings.includes(investorId)) return true;
        if (investorName && includesNameToken(asStrings, investorName)) return true;
      }

      // (2) tagged investors in notes
      const tags = parseInvestorTags(p?.notes);
      if (investorName && includesNameToken(tags, investorName)) return true;

      // (3) legacy fuzzy: investor name appears in notes or owning_llc
      if (investorName && (fuzzyIncludes(p?.notes, investorName) || fuzzyIncludes(p?.owning_llc, investorName))) {
        return true;
      }

      return false;
    });

    const aum = investments.reduce((sum, p) => sum + toNumber(p?.valuation, 0), 0);

    // Placeholder: assume investor has a stake in each investment
    const investorEquity = aum * assumedStake;
    const projectedDistributions = investorEquity * assumedYield;

    const accredited = typeof activeInvestor?.accredited === 'boolean' ? activeInvestor.accredited : null;

    container.innerHTML = `
      <div class="p-10 bg-slate-50 min-h-screen">
        <div class="max-w-6xl mx-auto space-y-8">
          <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <h1 class="text-3xl font-black text-slate-900">Investor Portal</h1>
              <p class="text-slate-600 font-semibold">
                Welcome back, <span class="text-slate-900 font-black">${escapeHtml(firstName)}</span>
              </p>
            </div>

            <div class="flex flex-col sm:flex-row gap-3">
              <button data-action="investor-download-statement"
                class="px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs tracking-wider uppercase transition-all">
                DOWNLOAD STATEMENT
              </button>

              <button data-action="investor-switch"
                class="px-5 py-3 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-black text-xs tracking-wider uppercase transition-all">
                SWITCH INVESTOR
              </button>
            </div>
          </div>

          <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div class="flex items-center gap-3">
                  <h2 class="text-xl font-black text-slate-900">${escapeHtml(activeInvestor?.name || 'Investor')}</h2>
                  ${accredited === true ? `
                    <span class="text-[10px] font-black px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                      VERIFIED ACCREDITED
                    </span>
                  ` : accredited === false ? `
                    <span class="text-[10px] font-black px-3 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                      UNVERIFIED
                    </span>
                  ` : `
                    <span class="text-[10px] font-black px-3 py-1 rounded-full bg-slate-50 text-slate-600 border border-slate-200">
                      PROFILE ACTIVE
                    </span>
                  `}
                </div>
                <p class="text-sm text-slate-500 font-semibold mt-1">
                  ${escapeHtml(activeInvestor?.email || '')}
                  ${activeInvestor?.phone ? ` • ${escapeHtml(activeInvestor.phone)}` : ''}
                </p>
                <p class="text-[11px] font-semibold text-slate-400 mt-2">
                  Assumptions: Stake ${formatters.percent(assumedStake)} • Annual Yield ${formatters.percent(assumedYield)}
                </p>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full md:w-auto">
                <div class="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Invested Equity</div>
                  <div class="text-lg font-black text-slate-900">${formatters.dollars(investorEquity)}</div>
                </div>
                <div class="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Projected Annual Distributions</div>
                  <div class="text-lg font-black text-slate-900">${formatters.dollars(projectedDistributions)}</div>
                </div>
                <div class="p-4 rounded-xl bg-slate-50 border border-slate-100">
                  <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Portfolio AUM</div>
                  <div class="text-lg font-black text-slate-900">${formatters.dollars(aum)}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div class="p-6 border-b border-slate-100 flex items-center justify-between">
              <h3 class="text-sm font-black text-slate-900 uppercase tracking-wider">Active Investments</h3>
              <div class="text-[11px] font-semibold text-slate-500">
                ${investments.length} properties linked
              </div>
            </div>

            <div class="divide-y divide-slate-100">
              ${
                investments.length
                  ? investments.map((p) => {
                      const name = escapeHtml(p?.name || 'Unnamed Property');
                      const units = toNumber(p?.units, 0);
                      const occ = toNumber(p?.occupancy, 0);
                      const val = toNumber(p?.valuation, 0);

                      const estEquity = val * assumedStake;
                      const estDist = estEquity * assumedYield;

                      return `
                        <div class="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                          <div>
                            <div class="text-lg font-black text-slate-900">${name}</div>
                            <div class="text-sm font-semibold text-slate-500 mt-1">
                              ${units ? `${escapeHtml(units)} Units` : 'Units N/A'} • ${escapeHtml(occ)}% Occupancy
                            </div>
                            <div class="text-[11px] font-semibold text-slate-400 mt-2">
                              Estimated LP Equity: ${formatters.dollars(estEquity)} • Estimated Annual Distributions: ${formatters.dollars(estDist)}
                            </div>
                          </div>

                          <div class="flex gap-2">
                            <button
                              data-action="investor-view-k1"
                              data-property-id="${escapeHtml(p?.id)}"
                              class="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-wider transition-all">
                              VIEW K-1
                            </button>

                            <button
                              data-action="investor-view-property"
                              data-property-id="${escapeHtml(p?.id)}"
                              class="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-black text-xs uppercase tracking-wider transition-all">
                              VIEW DETAILS
                            </button>
                          </div>
                        </div>
                      `;
                    }).join('')
                  : `
                    <div class="p-10 text-center text-slate-400">
                      <div class="text-4xl opacity-20 mb-3"><i class="fa fa-building"></i></div>
                      <p class="font-bold">No investments found for this investor.</p>
                      <p class="text-sm font-semibold mt-1">
                        Add a property note like: <span class="font-black">investors: ${escapeHtml(investorName || 'Investor Name')}</span>
                      </p>
                    </div>
                  `
              }
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  },

  bindEvents() {
    const container = document.getElementById('view-investor-portal');
    if (!container) return;

    if (this._bound) return;
    this._bound = true;

    container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;

      if (action === 'investor-download-statement') {
        window.dispatchEvent(new CustomEvent('investorPortal:download-statement'));
        showComingSoon('Download statement', 'Statement downloads are not wired yet.', 'Hook this up to your Uploads/Vault system.');
        return;
      }

      if (action === 'investor-switch') {
        // Minimal MVP: allow selection via modal using existing investors in state
        this.showInvestorSwitchModal();
        return;
      }

      if (action === 'investor-view-k1') {
        const propertyId = btn.dataset.propertyId || '';
        window.dispatchEvent(new CustomEvent('investorPortal:view-k1', { detail: { propertyId } }));
        showComingSoon('View K-1', 'K-1 retrieval is not wired yet.', 'Attach K-1 PDFs in Uploads, then link by investor/property.');
        return;
      }

      if (action === 'investor-view-property') {
        const propertyId = btn.dataset.propertyId || '';
        window.dispatchEvent(new CustomEvent('investorPortal:view-property', { detail: { propertyId } }));
        showComingSoon('Property details', 'Property detail linking is not wired from the portal yet.', 'You can route to Properties view and highlight this property.');
      }
    });
  },

  showInvestorSwitchModal() {
    const state = this._lastState || {};
    const investors = Array.isArray(state?.investors) ? state.investors : [];

    if (!investors.length) {
      showComingSoon('Switch investor', 'No investors available to switch.');
      return;
    }

    const activeId = getActiveInvestorId(state) || String(investors[0]?.id ?? '');

    modalManager.show(
      'Switch investor',
      `
        <div class="space-y-4">
          <p class="text-sm font-semibold text-slate-700">Select the investor profile to view in the portal.</p>

          <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Investor</label>
          <select id="portal-investor-select"
            class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10">
            ${
              investors.map((inv) => {
                const id = String(inv?.id ?? '');
                const name = escapeHtml(inv?.name || 'Investor');
                return `<option value="${escapeHtml(id)}" ${id === activeId ? 'selected' : ''}>${name}</option>`;
              }).join('')
            }
          </select>

          <p class="text-[11px] font-semibold text-slate-400">
            This selection is stored in your browser session for convenience.
          </p>
        </div>
      `,
      () => {
        const sel = document.getElementById('portal-investor-select');
        const id = sel?.value ? String(sel.value) : '';

        if (!id) throw new Error('Please select an investor.');

        try {
          sessionStorage.setItem('active_investor_id', id);
        } catch (_) {}

        // Re-render with new selection
        this._bound = false; // allow bindEvents to attach once per view lifetime? (kept false to avoid double-binding)
        // Better: keep bound; we don't need to rebind. Do not change _bound.
        this.render(this._lastState);

        return true;
      },
      { submitLabel: 'Switch', cancelLabel: 'Cancel' }
    );

    // Do NOT unset _bound; it is already bound. We keep it stable.
    this._bound = true;
  }
};
