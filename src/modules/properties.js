/**
 * src/modules/properties.js
 * Property portfolio tracker (Asset Mgmt)
 *
 * Full overwrite updates included:
 * - Array guards (state.properties/state.llcs)
 * - Bind-once delegated events on #view-properties
 * - Delete uses modalManager (danger)
 * - Modal save callbacks return true (close reliably)
 * - Safe numeric math + clamps
 * - escapeHtml on displayed fields
 * - LLC linking:
 *    - Add/Edit writes both llc_id (canonical) + owning_llc (legacy/back-compat)
 * - Filter row:
 *    - Debounced search ONLY
 *    - Min Cap Rate (%), Min NOI, Min Occupancy (%), Min Units, LLC filter
 */

import { stateManager } from '../state.js';
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

function toInt(v, fallback = 0) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function normalizeKey(v) {
  return String(v ?? '').trim().toLowerCase();
}

function idEq(a, b) {
  return String(a ?? '') === String(b ?? '');
}

function getProperties(state) {
  return Array.isArray(state?.properties) ? state.properties : [];
}

function getLLCs(state) {
  return Array.isArray(state?.llcs) ? state.llcs : [];
}

function computeCapRate(noi, valuation) {
  const val = toNumber(valuation, 0);
  const n = toNumber(noi, 0);
  if (val <= 0) return 0;
  return n / val; // decimal
}

function debounce(fn, wait = 250) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

export const properties = {
  _bound: false,
  _lastState: null,
  _filters: {
    q: '',
    minCap: '',
    minNoi: '',
    minOcc: '',
    minUnits: '',
    llcId: ''
  },

  render(state) {
    const container = document.getElementById('view-properties');
    if (!container) return;

    this._lastState = state;

    const list = getProperties(state);

    const totalValuation = list.reduce((sum, p) => sum + toNumber(p?.valuation, 0), 0);
    const totalLoan = list.reduce((sum, p) => sum + toNumber(p?.loan_balance, 0), 0);
    const totalUnits = list.reduce((sum, p) => sum + toInt(p?.units, 0), 0);
    const avgOcc =
      list.length > 0 ? list.reduce((sum, p) => sum + toNumber(p?.occupancy, 0), 0) / list.length : 0;

    container.innerHTML = `
      <div class="p-6">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 class="text-2xl font-bold text-gray-900">Asset Management Portfolio</h2>
            <p class="text-sm text-gray-500 font-medium">
              ${list.length} properties • Valuation: ${formatters.dollars(totalValuation)} • Loan: ${formatters.dollars(totalLoan)} • Units: ${totalUnits} • Avg Occ: ${avgOcc.toFixed(1)}%
            </p>
          </div>

          <button id="add-property-btn"
            class="bg-slate-900 text-white px-5 py-2.5 rounded-lg hover:bg-slate-800 font-bold shadow-sm transition-all flex items-center text-sm">
            <i class="fa fa-plus mr-2"></i>Add Property
          </button>
        </div>

        ${this.renderFilterRow()}

        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6" id="property-grid">
          ${this.renderPropertyCards(this.getFilteredList())}
        </div>
      </div>
    `;

    this.bindEvents();
  },

  renderFilterRow() {
    const llcs = getLLCs(this._lastState);
    const f = this._filters;

    return `
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
          <div class="md:col-span-2">
            <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Search</label>
            <input id="prop-filter-q" type="text" placeholder="Name / LLC / anything…"
              value="${escapeHtml(f.q)}"
              class="w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500">
          </div>

          <div>
            <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Min Cap %</label>
            <input id="prop-filter-mincap" type="number" placeholder="e.g. 6"
              value="${escapeHtml(f.minCap)}"
              class="w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500">
          </div>

          <div>
            <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Min NOI</label>
            <input id="prop-filter-minnoi" type="number" placeholder="e.g. 100000"
              value="${escapeHtml(f.minNoi)}"
              class="w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500">
          </div>

          <div>
            <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Min Occ %</label>
            <input id="prop-filter-minocc" type="number" placeholder="e.g. 90"
              value="${escapeHtml(f.minOcc)}"
              class="w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500">
          </div>

          <div>
            <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Min Units</label>
            <input id="prop-filter-minunits" type="number" placeholder="e.g. 50"
              value="${escapeHtml(f.minUnits)}"
              class="w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500">
          </div>

          <div class="md:col-span-2">
            <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">LLC</label>
            <select id="prop-filter-llc"
              class="w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500">
              <option value="">All LLCs</option>
              ${llcs.map(l => {
                const id = String(l?.id ?? '');
                const sel = idEq(id, f.llcId) ? 'selected' : '';
                return `<option value="${escapeHtml(id)}" ${sel}>${escapeHtml(l?.name || 'Unnamed LLC')}</option>`;
              }).join('')}
            </select>
          </div>

          <div class="md:col-span-2 flex gap-2">
            <button data-action="prop-filter-clear"
              class="w-full bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider hover:bg-gray-50">
              Clear
            </button>
          </div>
        </div>
      </div>
    `;
  },

  getFilteredList() {
    const list = getProperties(this._lastState);
    const llcs = getLLCs(this._lastState);
    const f = this._filters;

    const q = normalizeKey(f.q);
    const minCap = f.minCap !== '' ? toNumber(f.minCap, 0) / 100 : null; // percent -> decimal
    const minNoi = f.minNoi !== '' ? toNumber(f.minNoi, 0) : null;
    const minOcc = f.minOcc !== '' ? toNumber(f.minOcc, 0) : null;
    const minUnits = f.minUnits !== '' ? toInt(f.minUnits, 0) : null;
    const llcId = String(f.llcId ?? '').trim();

    // Pre-map llc names for quick matching
    const llcNameById = new Map(llcs.map(l => [String(l?.id ?? ''), String(l?.name ?? '')]));

    return list.filter((p) => {
      const name = normalizeKey(p?.name);
      const owning_llc = normalizeKey(p?.owning_llc);
      const llc_id = String(p?.llc_id ?? '').trim();
      const llcName = normalizeKey(llcNameById.get(llc_id) || '');

      // search filter
      if (q) {
        const hay = `${name} ${owning_llc} ${llcName}`.trim();
        if (!hay.includes(q)) return false;
      }

      // LLC filter
      if (llcId) {
        if (!idEq(llc_id, llcId)) return false;
      }

      // numeric filters
      const occ = toNumber(p?.occupancy, 0);
      const units = toInt(p?.units, 0);
      const noi = toNumber(p?.actual_noi, 0);
      const cap = computeCapRate(noi, p?.valuation);

      if (minOcc !== null && occ < minOcc) return false;
      if (minUnits !== null && units < minUnits) return false;
      if (minNoi !== null && noi < minNoi) return false;
      if (minCap !== null && cap < minCap) return false;

      return true;
    });
  },

  renderPropertyCards(propertyList) {
    if (!propertyList || propertyList.length === 0) {
      return `
        <div class="col-span-full py-20 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-white">
          <i class="fa fa-building text-4xl mb-3 opacity-20"></i>
          <p>No properties match your filters.</p>
        </div>
      `;
    }

    const llcs = getLLCs(this._lastState);
    const llcNameById = new Map(llcs.map(l => [String(l?.id ?? ''), String(l?.name ?? '')]));

    return propertyList.map((prop) => {
      const id = escapeHtml(prop?.id);
      const name = escapeHtml(prop?.name || 'Unnamed Property');

      const valuation = toNumber(prop?.valuation, 0);
      const loan = toNumber(prop?.loan_balance, 0);
      const units = toInt(prop?.units, 0);
      const occ = clamp(toNumber(prop?.occupancy, 0), 0, 100);
      const noi = toNumber(prop?.actual_noi, 0);

      const cap = computeCapRate(noi, valuation); // decimal

      const llcId = String(prop?.llc_id ?? '').trim();
      const llcName = llcNameById.get(llcId) || prop?.owning_llc || '—';
      const llcLabel = escapeHtml(llcName);

      const occupancyColor = occ < 90 ? 'text-orange-600' : 'text-emerald-600';

      return `
        <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow group">
          <div class="p-5">
            <div class="flex justify-between items-start mb-3">
              <span class="px-2 py-1 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600">
                ${units} UNITS
              </span>

              <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button data-action="prop-edit" data-id="${id}"
                  class="text-gray-400 hover:text-slate-700" title="Edit">
                  <i class="fa fa-pen text-xs"></i>
                </button>

                <button data-action="prop-delete" data-id="${id}"
                  class="text-gray-400 hover:text-red-500" title="Delete">
                  <i class="fa fa-trash text-xs"></i>
                </button>
              </div>
            </div>

            <h3 class="font-bold text-gray-900 text-lg mb-1 truncate">${name}</h3>
            <p class="text-xs text-gray-500 mb-4 truncate">
              <i class="fa fa-landmark mr-1"></i>${llcLabel}
            </p>

            <div class="grid grid-cols-2 gap-4 border-t border-gray-50 pt-4">
              <div>
                <p class="text-[10px] text-gray-400 font-bold uppercase">Valuation</p>
                <p class="text-sm font-bold text-gray-900">${formatters.dollars(valuation)}</p>
              </div>
              <div>
                <p class="text-[10px] text-gray-400 font-bold uppercase">Loan Balance</p>
                <p class="text-sm font-bold text-gray-900">${formatters.dollars(loan)}</p>
              </div>
              <div>
                <p class="text-[10px] text-gray-400 font-bold uppercase">Occupancy</p>
                <p class="text-sm font-bold ${occupancyColor}">${occ.toFixed(1)}%</p>
              </div>
              <div>
                <p class="text-[10px] text-gray-400 font-bold uppercase">Cap Rate</p>
                <p class="text-sm font-bold text-slate-900">${(cap * 100).toFixed(2)}%</p>
              </div>
            </div>
          </div>

          <div class="bg-gray-50 px-5 py-3 flex justify-between items-center">
            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">
              NOI: ${formatters.dollars(noi)}
            </span>
            <button data-action="prop-edit" data-id="${id}"
              class="text-xs font-bold text-slate-600 hover:text-orange-600 transition-colors">
              Edit <i class="fa fa-chevron-right ml-1"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  bindEvents() {
    const container = document.getElementById('view-properties');
    if (!container) return;

    const addBtn = document.getElementById('add-property-btn');
    if (addBtn) addBtn.onclick = () => this.showAddPropertyModal();

    if (this._bound) return;
    this._bound = true;

    // Click delegation
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const id = btn.dataset.id || '';

      if (action === 'prop-delete') {
        this.confirmDelete(id);
        return;
      }

      if (action === 'prop-edit') {
        this.openEditById(id);
        return;
      }

      if (action === 'prop-filter-clear') {
        this._filters = { q: '', minCap: '', minNoi: '', minOcc: '', minUnits: '', llcId: '' };
        this.render(this._lastState);
      }
    });

    // Filter input bindings (debounce ONLY the search box)
    const qEl = document.getElementById('prop-filter-q');
    const capEl = document.getElementById('prop-filter-mincap');
    const noiEl = document.getElementById('prop-filter-minnoi');
    const occEl = document.getElementById('prop-filter-minocc');
    const unitsEl = document.getElementById('prop-filter-minunits');
    const llcEl = document.getElementById('prop-filter-llc');

    const apply = () => this.render(this._lastState);
    const applyDebounced = debounce(apply, 250);

    if (qEl) qEl.addEventListener('input', () => { this._filters.q = qEl.value; applyDebounced(); });

    // Non-debounced filters
    if (capEl) capEl.addEventListener('input', () => { this._filters.minCap = capEl.value; apply(); });
    if (noiEl) noiEl.addEventListener('input', () => { this._filters.minNoi = noiEl.value; apply(); });
    if (occEl) occEl.addEventListener('input', () => { this._filters.minOcc = occEl.value; apply(); });
    if (unitsEl) unitsEl.addEventListener('input', () => { this._filters.minUnits = unitsEl.value; apply(); });
    if (llcEl) llcEl.addEventListener('change', () => { this._filters.llcId = llcEl.value; apply(); });
  },

  confirmDelete(id) {
    const list = getProperties(this._lastState);
    const prop = list.find(p => idEq(p?.id, id));
    const label = prop?.name ? `“${prop.name}”` : 'this property';

    modalManager.show(
      'Delete property',
      `<p class="text-sm font-semibold text-slate-700">Delete ${escapeHtml(label)}? This cannot be undone.</p>`,
      () => {
        stateManager.delete('properties', id);
        return true;
      },
      { submitLabel: 'Delete', cancelLabel: 'Cancel', danger: true }
    );
  },

  openEditById(id) {
    const list = getProperties(this._lastState);
    const prop = list.find(p => idEq(p?.id, id));

    if (!prop) {
      modalManager.show(
        'Property not found',
        `<p class="text-sm font-semibold text-slate-700">That property could not be found.</p>`,
        () => true,
        { submitLabel: 'Close', hideCancel: true }
      );
      return;
    }

    this.showEditPropertyModal(prop);
  },

  showAddPropertyModal() {
    const llcs = getLLCs(this._lastState);

    const formHtml = this.getPropertyFormHtml(null, llcs);

    modalManager.show(
      'Add Property',
      formHtml,
      () => {
        const data = this.readPropertyFormData(llcs);

        if (!data.name) throw new Error('Property name is required.');

        const now = new Date().toISOString();
        data.created_at = now;
        data.createdAt = now;

        stateManager.add('properties', data);
        return true;
      },
      { submitLabel: 'Add', cancelLabel: 'Cancel' }
    );
  },

  showEditPropertyModal(prop) {
    const llcs = getLLCs(this._lastState);

    const formHtml = this.getPropertyFormHtml(prop, llcs);

    modalManager.show(
      'Edit Property',
      formHtml,
      () => {
        const patch = this.readPropertyFormData(llcs);

        if (!patch.name) throw new Error('Property name is required.');

        const now = new Date().toISOString();
        patch.updated_at = now;
        patch.updatedAt = now;

        stateManager.update('properties', prop.id, patch);
        return true;
      },
      { submitLabel: 'Save', cancelLabel: 'Cancel' }
    );
  },

  getPropertyFormHtml(prop, llcs) {
    const isEdit = !!prop;

    const name = escapeHtml(prop?.name || '');
    const llcId = String(prop?.llc_id ?? '');
    const owning = escapeHtml(prop?.owning_llc || '');
    const valuation = toNumber(prop?.valuation, 0);
    const loan = toNumber(prop?.loan_balance, 0);
    const units = toInt(prop?.units, 0);
    const occ = toNumber(prop?.occupancy, 0);
    const noi = toNumber(prop?.actual_noi, 0);

    return `
      <div class="grid grid-cols-2 gap-4">
        <div class="col-span-2">
          <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Property Name</label>
          <input type="text" id="prop-name"
            class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
            placeholder="e.g. Bella Rosa" value="${name}">
        </div>

        <div class="col-span-2">
          <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Owning LLC</label>
          <select id="prop-llc-id"
            class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none">
            <option value="">Unassigned</option>
            ${llcs.map(l => {
              const id = String(l?.id ?? '');
              const sel = idEq(id, llcId) ? 'selected' : '';
              return `<option value="${escapeHtml(id)}" ${sel}>${escapeHtml(l?.name || 'Unnamed LLC')}</option>`;
            }).join('')}
          </select>
          <p class="text-[11px] font-semibold text-slate-400 mt-2">
            Legacy field <span class="font-black">owning_llc</span> will stay in sync automatically.
          </p>
        </div>

        <div>
          <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Valuation</label>
          <input type="number" id="prop-val"
            class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
            value="${valuation}">
        </div>

        <div>
          <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Loan Balance</label>
          <input type="number" id="prop-loan"
            class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
            value="${loan}">
        </div>

        <div>
          <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Units</label>
          <input type="number" id="prop-units"
            class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
            value="${units}">
        </div>

        <div>
          <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Occupancy %</label>
          <input type="number" id="prop-occ"
            class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
            value="${occ}">
        </div>

        <div class="col-span-2">
          <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Actual NOI (Annual)</label>
          <input type="number" id="prop-noi"
            class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
            value="${noi}">
        </div>

        ${
          isEdit
            ? `<div class="col-span-2 p-3 rounded-lg bg-slate-50 border border-slate-200">
                <div class="text-[11px] font-semibold text-slate-500">
                  Current owning_llc (legacy): <span class="font-black text-slate-900">${owning || '—'}</span>
                </div>
              </div>`
            : ''
        }
      </div>
    `;
  },

  readPropertyFormData(llcs) {
    const name = String(document.getElementById('prop-name')?.value ?? '').trim();
    const selectedLlcId = String(document.getElementById('prop-llc-id')?.value ?? '').trim();

    const llc = llcs.find(l => idEq(l?.id, selectedLlcId));
    const owning_llc = llc ? String(llc.name || '').trim() : '';

    return {
      name,
      llc_id: selectedLlcId || '',
      owning_llc, // keep for legacy/back-compat
      valuation: toNumber(document.getElementById('prop-val')?.value, 0),
      loan_balance: toNumber(document.getElementById('prop-loan')?.value, 0),
      units: toInt(document.getElementById('prop-units')?.value, 0),
      occupancy: clamp(toNumber(document.getElementById('prop-occ')?.value, 0), 0, 100),
      actual_noi: toNumber(document.getElementById('prop-noi')?.value, 0)
    };
  }
};

// Compatibility exports (if main.js imports named functions)
export const renderProperties = (state) => properties.render(state);
export const showAddPropertyModal = () => properties.showAddPropertyModal();
