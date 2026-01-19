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

/**
 * Canonical stage definitions.
 *
 * IMPORTANT:
 * - We store the stage as a stable `id` (e.g., "dd_started") rather than the display label.
 * - For backward compatibility, we still accept older saved deals whose `stage` is a label
 *   (e.g., "Closing"). Those are normalized at render/save time.
 */
export const DEAL_STAGES = [
  { id: 'sourced', label: 'Sourced' },
  { id: 'underwriting', label: 'Underwriting' },
  { id: 'loi_sent', label: 'LOI Sent' },
  { id: 'counter_received', label: 'Counter Received' },
  { id: 'loi_accepted', label: 'LOI Accepted' },
  { id: 'awaiting_dd_docs', label: 'Awaiting DD Docs' },
  { id: 'dd_started', label: 'Due Diligence Started' },
  { id: 'dd_loi_mods_needed', label: 'DD LOI Modifications Needed' },
  { id: 'dd_loi_mods_accepted', label: 'DD LOI Modifications Accepted' },
  { id: 'closing', label: 'Closing' },
  { id: 'deal_abandoned', label: 'Deal Abandoned' },
  { id: 'asset_mgmt', label: 'Asset Management' }
];

const STAGE_BY_ID = Object.fromEntries(DEAL_STAGES.map((s) => [s.id, s]));
const STAGE_ID_BY_LABEL = Object.fromEntries(
  DEAL_STAGES.map((s) => [String(s.label).toLowerCase(), s.id])
);

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

function normalizeStageId(stage) {
  const raw = String(stage ?? '').trim();
  if (!raw) return 'sourced';
  const lower = raw.toLowerCase();

  // Already a canonical id
  if (STAGE_BY_ID[raw]) return raw;
  if (STAGE_BY_ID[lower]) return lower;

  // Backward-compat: stored as label
  if (STAGE_ID_BY_LABEL[lower]) return STAGE_ID_BY_LABEL[lower];

  // Heuristic: normalize to underscore id
  const candidate = lower.replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  if (STAGE_BY_ID[candidate]) return candidate;

  return 'sourced';
}

function stageLabel(stage) {
  const id = normalizeStageId(stage);
  return STAGE_BY_ID[id]?.label || 'Sourced';
}

function isStage(stage, id) {
  return normalizeStageId(stage) === id;
}

function isAssetMgmtStage(stage) {
  return isStage(stage, 'asset_mgmt');
}

async function ensurePropertyFromDeal(deal) {
  if (!deal || !deal.id) return;

  const st = stateManager.get();
  const props = Array.isArray(st?.properties) ? st.properties : [];

  // Prevent duplicates: if a property already references this deal, do nothing
  const exists = props.some((p) => String(p?.deal_id ?? '') === String(deal.id));
  if (exists) return;

  const propName = String(deal?.name || '').trim() || 'Unnamed Property';
  const valuation = toNumber(deal?.price, 0);
  const units = toInt(deal?.units, 0);

  await stateManager.add('properties', {
    name: propName,
    valuation,
    units,
    deal_id: String(deal.id),
    source: 'deal_pipeline',
    created_from_stage: String(deal?.stage || '')
  });
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

    const allDeals = getDealsFromArg(stateOrDeals);
    this._lastDeals = allDeals;

    // Pipeline view intentionally hides Asset Management deals.
    // Once a deal is promoted to assets, it should be managed from the Assets tab.
    const pipelineDeals = allDeals.filter((d) => !isAssetMgmtStage(d?.stage));

    const totalVolume = pipelineDeals.reduce((sum, d) => sum + toNumber(d?.price, 0), 0);

    container.innerHTML = `
      <div class="p-6">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 class="text-2xl font-bold text-gray-900">Acquisition Pipeline</h2>
            <p class="text-sm text-gray-500 font-medium">
              Tracking ${pipelineDeals.length} opportunities • Total Volume: ${formatters.dollars(totalVolume)}
            </p>
          </div>

          <button id="add-deal-btn"
            class="bg-slate-900 text-white px-5 py-2.5 rounded-lg hover:bg-slate-800 font-bold shadow-sm transition-all flex items-center text-sm">
            <i class="fa fa-plus mr-2"></i>Add Deal
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
          ${this.renderDealCards(pipelineDeals)}
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

        const stageId = normalizeStageId(deal?.stage);
        const stageLabelText = stageLabel(deal?.stage);
        const stageLabelEsc = escapeHtml(stageLabelText);
        const name = escapeHtml(deal?.name || 'Unnamed Deal');
        const address = escapeHtml(deal?.address || 'Address not set');

        return `
          <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:border-orange-300 transition-all group">
            <div class="p-5">
              <div class="flex justify-between items-start mb-4">
                <span class="px-2 py-1 rounded text-[10px] font-bold uppercase ${this.getStageClass(stageId)}">
                  ${stageLabelEsc}
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

            <div class="bg-gray-50 px-5 py-3 flex justify-between items-center gap-2">
              <span class="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Units: ${units}</span>

              <div class="flex items-center gap-3">
                ${
                  stageId === 'closing'
                    ? `<button data-action="deal-to-assets" data-id="${escapeHtml(deal?.id)}"
                        class="text-xs font-black text-emerald-700 hover:text-emerald-800 transition-colors">
                        Move to Assets <i class="fa fa-arrow-right ml-1"></i>
                      </button>`
                    : ''
                }

                <button data-action="deal-details" data-id="${escapeHtml(deal?.id)}"
                  class="text-xs font-bold text-slate-600 hover:text-orange-600 transition-colors">
                  Analyze Deal <i class="fa fa-chevron-right ml-1"></i>
                </button>
              </div>
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

      if (action === 'deal-to-assets') {
        this.promoteToAssets(id);
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

  async promoteToAssets(id) {
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

    // Move stage to Asset Management (canonical id)
    const patch = {
      stage: 'asset_mgmt',
      updated_at: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    stateManager.update('deals', id, patch);

    // Create linked property (idempotent)
    await ensurePropertyFromDeal({ ...deal, stage: 'asset_mgmt' });

    // Jump to Assets
    router.navigate('properties');
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

        const created = stateManager.add('deals', data);

        // Auto-promote if added directly to Asset Management
        // (idempotent; will not create duplicate properties)
        setTimeout(() => {
          try {
            const st = stateManager.get();
            const dealsList = Array.isArray(st?.deals) ? st.deals : [];
            const createdId = typeof created === 'object' ? created?.id : created;
            const d = dealsList.find((x) => String(x?.id) === String(createdId)) || dealsList[dealsList.length - 1];
            if (d && isAssetMgmtStage(d?.stage)) ensurePropertyFromDeal(d);
          } catch (_) {
            // ignore
          }
        }, 0);
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

        // Auto-promote if stage is Asset Management
        setTimeout(() => {
          try {
            const st = stateManager.get();
            const dealsList = Array.isArray(st?.deals) ? st.deals : [];
            const d = dealsList.find((x) => String(x?.id) === String(deal.id));
            if (d && isAssetMgmtStage(d?.stage)) ensurePropertyFromDeal(d);
          } catch (_) {
            // ignore
          }
        }, 0);
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
    const stageId = normalizeStageId(deal?.stage || 'sourced');
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
            ${DEAL_STAGES.map(
              (s) =>
                `<option value="${escapeHtml(s.id)}" ${stageId === s.id ? 'selected' : ''}>${escapeHtml(
                  s.label
                )}</option>`
            ).join('')}
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
    const stageRaw = String(document.getElementById('deal-stage')?.value ?? 'sourced').trim();
    return {
      name: String(document.getElementById('deal-name')?.value ?? '').trim(),
      address: String(document.getElementById('deal-address')?.value ?? '').trim(),
      price: toNumber(document.getElementById('deal-price')?.value, 0),
      stage: normalizeStageId(stageRaw),
      rehab: toNumber(document.getElementById('deal-rehab')?.value, 0),
      closing_costs: toNumber(document.getElementById('deal-closing_costs')?.value, 0),
      units: toInt(document.getElementById('deal-units')?.value, 0),
      proforma_noi: toNumber(document.getElementById('deal-proforma_noi')?.value, 0)
    };
  },

  getStageClass(stage) {
    const id = normalizeStageId(stage);
    if (id === 'closing') return 'bg-emerald-100 text-emerald-700';
    if (id === 'asset_mgmt') return 'bg-emerald-50 text-emerald-700';
    if (id === 'deal_abandoned') return 'bg-red-100 text-red-700';

    if (id === 'loi_sent') return 'bg-blue-100 text-blue-700';
    if (id === 'counter_received') return 'bg-indigo-100 text-indigo-700';
    if (id === 'loi_accepted') return 'bg-sky-100 text-sky-700';

    if (id === 'awaiting_dd_docs') return 'bg-violet-100 text-violet-700';
    if (id === 'dd_started') return 'bg-violet-100 text-violet-700';
    if (id === 'dd_loi_mods_needed') return 'bg-fuchsia-100 text-fuchsia-700';
    if (id === 'dd_loi_mods_accepted') return 'bg-purple-100 text-purple-700';

    if (id === 'underwriting') return 'bg-orange-100 text-orange-700';
    return 'bg-slate-100 text-slate-600';
  }
};

// Keep these named exports for compatibility with main.js imports
export const showAddDealModal = () => deals.showAddDealModal();
export const renderDeals = (stateOrDeals) => deals.render(stateOrDeals);
