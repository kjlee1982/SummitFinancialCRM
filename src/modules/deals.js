/**
 * src/modules/deals.js
 * Manages the Acquisition Pipeline with integrated Financial Underwriting.
 *
 * Overwrite updates included:
 * - Event delegation (single handler; no rebinding issues)
 * - Delete uses modalManager (danger button) instead of confirm()
 * - "Analyze Deal" stores selected deal id + navigates to deal-analyzer view (with safe fallback)
 * - created_at added (while remaining compatible with stateManager.createdAt behavior)
 * - Escapes user-entered fields to prevent HTML injection/broken layouts
 * - Adds optional Edit modal (small but very useful)
 *
 * Compatibility note:
 * main.js currently calls renderDeals(state.deals) (an ARRAY), so this module accepts either:
 * - deals.render(stateObject) OR deals.render(dealsArray)
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

function toInt(v, fallback = 0) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function getDealsFromArg(stateOrDeals) {
  if (Array.isArray(stateOrDeals)) return stateOrDeals;
  return Array.isArray(stateOrDeals?.deals) ? stateOrDeals.deals : [];
}

export const deals = {
  _bound: false,
  _lastDeals: [],

  /**
   * Main render function called by main.js
   * Accepts either a deals array OR a full state object.
   */
  render(stateOrDeals) {
    const container = document.getElementById('view-deals');
    if (!container) return;

    const dealList = getDealsFromArg(stateOrDeals);
    this._lastDeals = dealList;

    const totalVolume = dealList.reduce((sum, d) => sum + toNumber(d?.price, 0), 0);

    container.innerHTML = `
      <div class="p-6">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 class="text-2xl font-bold text-gray-900">Acquisition Pipeline</h2>
            <p class="text-sm text-gray-500 font-medium">
              Tracking ${dealList.length} opportunities • Total Volume: ${formatters.dollars(totalVolume)}
            </p>
          </div>

          <button id="add-deal-btn"
            class="bg-slate-900 text-white px-5 py-2.5 rounded-lg hover:bg-slate-800 font-bold shadow-sm transition-all flex items-center text-sm">
            <i class="fa fa-plus mr-2"></i>Add Deal
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
          ${this.renderDealCards(dealList)}
        </div>
      </div>
    `;

    this.bindEvents();
  },

  renderDealCards(dealList) {
    if (!dealList || dealList.length === 0) {
      return `
        <div class="col-span-full py-20 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-white">
          <i class="fa fa-handshake text-4xl mb-3 opacity-20"></i>
          <p>No active deals in the pipeline.</p>
        </div>
      `;
    }

    return dealList
      .map((deal) => {
        const price = toNumber(deal?.price, 0);
        const rehab = toNumber(deal?.rehab, 0);
        const closing = toNumber(deal?.closing_costs, 0);
        const units = toInt(deal?.units, 0);
        const proformaNoi = toNumber(deal?.proforma_noi, 0);

        const totalBasis = price + rehab + closing;
        const yieldOnCost = totalBasis > 0 ? proformaNoi / totalBasis : 0;
        const ppu = units > 0 ? price / units : 0;

        const stageLabel = escapeHtml(deal?.stage || 'Sourced');
        const name = escapeHtml(deal?.name || 'Unnamed Deal');
        const address = escapeHtml(deal?.address || 'Address not set');

        return `
          <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:border-orange-300 transition-all group">
            <div class="p-5">
              <div class="flex justify-between items-start mb-4">
                <span class="px-2 py-1 rounded text-[10px] font-bold uppercase ${this.getStageClass(deal?.stage)}">
                  ${stageLabel}
                </span>

                <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button data-action="deal-edit" data-id="${escapeHtml(deal?.id)}"
                    class="text-gray-400 hover:text-slate-700" title="Edit">
                    <i class="fa fa-pen text-xs"></i>
                  </button>

                  <button data-action="deal-delete" data-id="${escapeHtml(deal?.id)}"
                    class="text-gray-400 hover:text-red-500" title="Delete">
                    <i class="fa fa-trash text-xs"></i>
                  </button>
                </div>
              </div>

              <h3 class="font-bold text-gray-900 text-lg mb-1 truncate">${name}</h3>
              <p class="text-xs text-gray-500 mb-4 truncate">
                <i class="fa fa-map-marker-alt mr-1"></i>${address}
              </p>

              <div class="grid grid-cols-2 gap-4 border-t border-gray-50 pt-4">
                <div>
                  <p class="text-[10px] text-gray-400 font-bold uppercase">Purchase Price</p>
                  <p class="text-sm font-bold text-gray-900">${formatters.dollars(price)}</p>
                </div>
                <div>
                  <p class="text-[10px] text-gray-400 font-bold uppercase">Yield on Cost</p>
                  <p class="text-sm font-bold text-orange-600">${formatters.percent(yieldOnCost)}</p>
                </div>
                <div>
                  <p class="text-[10px] text-gray-400 font-bold uppercase">Total Basis</p>
                  <p class="text-sm font-medium text-gray-700">${formatters.dollars(totalBasis)}</p>
                </div>
                <div>
                  <p class="text-[10px] text-gray-400 font-bold uppercase">$/Unit</p>
                  <p class="text-sm font-medium text-gray-700">${formatters.dollars(ppu)}</p>
                </div>
              </div>
            </div>

            <div class="bg-gray-50 px-5 py-3 flex justify-between items-center">
              <span class="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Units: ${units}</span>
              <button data-action="deal-details" data-id="${escapeHtml(deal?.id)}"
                class="text-xs font-bold text-slate-600 hover:text-orange-600 transition-colors">
                Analyze Deal <i class="fa fa-chevron-right ml-1"></i>
              </button>
            </div>
          </div>
        `;
      })
      .join('');
  },

  bindEvents() {
    const container = document.getElementById('view-deals');
    if (!container) return;

    // Bind add button (exists after each render)
    const addBtn = document.getElementById('add-deal-btn');
    if (addBtn) addBtn.onclick = () => this.showAddDealModal();

    // Delegated actions (bind once)
    if (this._bound) return;
    this._bound = true;

    container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const id = btn.dataset.id;

      if (action === 'deal-delete') {
        this.confirmDelete(id);
        return;
      }

      if (action === 'deal-edit') {
        this.openEditById(id);
        return;
      }

      if (action === 'deal-details') {
        this.openAnalyzer(id);
        return;
      }
    });
  },

  confirmDelete(id) {
    const deal = (this._lastDeals || []).find((d) => String(d?.id) === String(id));
    const label = deal?.name ? `“${deal.name}”` : 'this deal';

    modalManager.show(
      'Delete deal',
      `<p class="text-sm font-semibold text-slate-700">Delete ${escapeHtml(label)} from the pipeline? This cannot be undone.</p>`,
      () => {
        stateManager.delete('deals', id);
        return true;
      },
      {
        submitLabel: 'Delete',
        cancelLabel: 'Cancel',
        danger: true
      }
    );
  },

  openAnalyzer(id) {
    // Store selection for deal-analyzer view
    try {
      sessionStorage.setItem('selected_deal_id', String(id));
    } catch (_) {
      // ignore storage failures (private mode, etc.)
    }

    // Dispatch an event so deal-analyzer (or main.js) can react if it wants
    window.dispatchEvent(new CustomEvent('deal-analyzer:select', { detail: { id: String(id) } }));

    // Navigate to analyzer view (if main.js has a case for it, it will render)
    router.navigate('deal-analyzer');

    // Safe fallback: if the view isn't wired yet, show a quick modal summary
    // (This avoids "blank screen" confusion during integration.)
    const hasAnalyzerContainer =
      document.getElementById('view-deal-analyzer') ||
      document.getElementById('deal-analysis-results');

    if (!hasAnalyzerContainer) {
      const deal = (this._lastDeals || []).find((d) => String(d?.id) === String(id));
      if (!deal) return;

      const price = toNumber(deal?.price, 0);
      const rehab = toNumber(deal?.rehab, 0);
      const closing = toNumber(deal?.closing_costs, 0);
      const units = toInt(deal?.units, 0);
      const noi = toNumber(deal?.proforma_noi, 0);

      const totalBasis = price + rehab + closing;
      const yoc = totalBasis > 0 ? noi / totalBasis : 0;

      modalManager.show(
        'Deal analysis (quick view)',
        `
          <div class="space-y-3">
            <div class="text-sm font-black text-slate-900">${escapeHtml(deal?.name || 'Unnamed Deal')}</div>
            <div class="text-xs font-semibold text-slate-500">${escapeHtml(deal?.address || '')}</div>

            <div class="grid grid-cols-2 gap-3 pt-2">
              <div class="p-3 rounded-xl border border-slate-200 bg-white">
                <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Purchase</div>
                <div class="text-sm font-black text-slate-900">${formatters.dollars(price)}</div>
              </div>
              <div class="p-3 rounded-xl border border-slate-200 bg-white">
                <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Basis</div>
                <div class="text-sm font-black text-slate-900">${formatters.dollars(totalBasis)}</div>
              </div>
              <div class="p-3 rounded-xl border border-slate-200 bg-white">
                <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Proforma NOI</div>
                <div class="text-sm font-black text-slate-900">${formatters.dollars(noi)}</div>
              </div>
              <div class="p-3 rounded-xl border border-slate-200 bg-white">
                <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Yield on Cost</div>
                <div class="text-sm font-black text-slate-900">${formatters.percent(yoc)}</div>
              </div>
            </div>

            <div class="text-xs font-semibold text-slate-500 pt-2">
              Units: <span class="font-black text-slate-900">${units}</span>
            </div>

            <div class="text-[11px] font-semibold text-slate-400 pt-2">
              Tip: wire main.js to render the deal-analyzer view to replace this quick modal.
            </div>
          </div>
        `,
        () => true,
        { submitLabel: 'Close', hideCancel: true }
      );
    }
  },

  openEditById(id) {
    const deal = (this._lastDeals || []).find((d) => String(d?.id) === String(id));
    if (!deal) {
      modalManager.show(
        'Deal not found',
        `<p class="text-sm font-semibold text-slate-700">That deal could not be found. It may have been deleted or not synced yet.</p>`,
        () => true,
        { submitLabel: 'Close', hideCancel: true }
      );
      return;
    }

    this.showEditDealModal(deal);
  },

  showAddDealModal() {
    const formHtml = this.getDealFormHtml(null);

    modalManager.show(
      'Add New Opportunity',
      formHtml,
      () => {
        const data = this.readDealFormData();

        if (!data.name) throw new Error('Deal name is required.');

        // Add both snake_case and camelCase timestamps (stateManager will also add createdAt)
        data.created_at = new Date().toISOString();
        data.createdAt = data.created_at;

        stateManager.add('deals', data);
        return true;
      },
      {
        submitLabel: 'Add Deal',
        cancelLabel: 'Cancel'
      }
    );
  },

  showEditDealModal(deal) {
    const formHtml = this.getDealFormHtml(deal);

    modalManager.show(
      'Edit Deal',
      formHtml,
      () => {
        const patch = this.readDealFormData();

        if (!patch.name) throw new Error('Deal name is required.');

        patch.updated_at = new Date().toISOString();
        patch.updatedAt = patch.updated_at;

        stateManager.update('deals', deal.id, patch);
        return true;
      },
      {
        submitLabel: 'Save',
        cancelLabel: 'Cancel'
      }
    );
  },

  getDealFormHtml(deal = null) {
    const isEdit = !!deal;

    const name = escapeHtml(deal?.name || '');
    const address = escapeHtml(deal?.address || '');
    const price = toNumber(deal?.price, 0);
    const stage = escapeHtml(deal?.stage || 'Sourced');
    const rehab = toNumber(deal?.rehab, 0);
    const closing = toNumber(deal?.closing_costs, 0);
    const units = toInt(deal?.units, 0);
    const noi = toNumber(deal?.proforma_noi, 0);

    return `
      <div class="grid grid-cols-2 gap-4">
        <div class="col-span-2">
          <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Deal Name</label>
          <input type="text" id="deal-name"
            class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
            placeholder="e.g. Phoenix Portfolio" value="${name}">
        </div>

        <div class="col-span-2">
          <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Address</label>
          <input type="text" id="deal-address"
            class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
            placeholder="123 Investment St." value="${address}">
        </div>

        <div>
          <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Purchase Price</label>
          <input type="number" id="deal-price"
            class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
            value="${price}">
        </div>

        <div>
          <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Pipeline Stage</label>
          <select id="deal-stage" class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none">
            ${['Sourced', 'Underwriting', 'LOI Sent', 'Closing']
              .map((s) => `<option ${stage === s ? 'selected' : ''}>${escapeHtml(s)}</option>`)
              .join('')}
          </select>
        </div>

        <div class="col-span-2"><hr class="my-2 border-gray-100"></div>

        <div>
          <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Rehab Budget</label>
          <input type="number" id="deal-rehab"
            class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
            value="${rehab}" placeholder="0">
        </div>

        <div>
          <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Closing Costs</label>
          <input type="number" id="deal-closing_costs"
            class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
            value="${closing}" placeholder="0">
        </div>

        <div>
          <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Total Units</label>
          <input type="number" id="deal-units"
            class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
            value="${units}">
        </div>

        <div>
          <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Pro-Forma NOI (Annual)</label>
          <input type="number" id="deal-proforma_noi"
            class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
            value="${noi}">
        </div>

        ${
          isEdit
            ? `<p class="col-span-2 text-[11px] font-semibold text-slate-400 mt-1">Edits sync automatically after saving.</p>`
            : ''
        }
      </div>
    `;
  },

  readDealFormData() {
    return {
      name: String(document.getElementById('deal-name')?.value ?? '').trim(),
      address: String(document.getElementById('deal-address')?.value ?? '').trim(),
      price: toNumber(document.getElementById('deal-price')?.value, 0),
      stage: String(document.getElementById('deal-stage')?.value ?? 'Sourced').trim(),
      rehab: toNumber(document.getElementById('deal-rehab')?.value, 0),
      closing_costs: toNumber(document.getElementById('deal-closing_costs')?.value, 0),
      units: toInt(document.getElementById('deal-units')?.value, 0),
      proforma_noi: toNumber(document.getElementById('deal-proforma_noi')?.value, 0)
    };
  },

  getStageClass(stage) {
    const s = String(stage ?? '').toLowerCase();
    if (s === 'closing') return 'bg-emerald-100 text-emerald-700';
    if (s === 'loi sent') return 'bg-blue-100 text-blue-700';
    if (s === 'underwriting') return 'bg-orange-100 text-orange-700';
    return 'bg-slate-100 text-slate-600';
  }
};

// Keep these named exports for compatibility with main.js imports
export const showAddDealModal = () => deals.showAddDealModal();
export const renderDeals = (stateOrDeals) => deals.render(stateOrDeals);
