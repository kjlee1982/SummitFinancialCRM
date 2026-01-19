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

// Funnel order (excludes "deal_abandoned" since that's a terminal archive state)
const FUNNEL_STAGE_ORDER = [
  'sourced',
  'underwriting',
  'loi_sent',
  'counter_received',
  'loi_accepted',
  'awaiting_dd_docs',
  'dd_started',
  'dd_loi_mods_needed',
  'dd_loi_mods_accepted',
  'closing',
  'asset_mgmt'
];

const FUNNEL_RANK = Object.fromEntries(FUNNEL_STAGE_ORDER.map((id, idx) => [id, idx]));
const DD_STAGE_SET = new Set([
  'awaiting_dd_docs',
  'dd_started',
  'dd_loi_mods_needed',
  'dd_loi_mods_accepted'
]);

function isAbandonedDeal(deal) {
  if (!deal) return false;
  if (normalizeStageId(deal.stage) === 'deal_abandoned') return true;
  return Boolean(deal.isArchived) && String(deal.archiveType || '') === 'abandoned';
}

function getDealsSubview() {
  try {
    return sessionStorage.getItem('deals_subview') || 'pipeline';
  } catch (_) {
    return 'pipeline';
  }
}

function setDealsSubview(v) {
  try {
    sessionStorage.setItem('deals_subview', String(v || 'pipeline'));
  } catch (_) {
    // ignore
  }
}

function isoNow() {
  return new Date().toISOString();
}

function computeMaxFunnelRank(deal) {
  if (!deal) return FUNNEL_RANK.sourced;

  // Prefer explicit history if present
  const hist = Array.isArray(deal.stageHistory) ? deal.stageHistory : [];
  let max = -1;
  for (const h of hist) {
    const sid = normalizeStageId(h?.stage ?? h?.stageId ?? h?.id ?? h);
    if (sid === 'deal_abandoned') continue;
    const r = FUNNEL_RANK[sid];
    if (Number.isFinite(r)) max = Math.max(max, r);
  }

  // If abandoned, treat abandoned_from_stage as the terminal funnel stage
  if (isAbandonedDeal(deal)) {
    const from = normalizeStageId(deal.abandoned_from_stage || deal.abandonedFromStage || deal.created_from_stage);
    const r = FUNNEL_RANK[from];
    if (Number.isFinite(r)) max = Math.max(max, r);
  }

  // Always consider current stage
  const cur = normalizeStageId(deal.stage);
  if (cur !== 'deal_abandoned') {
    const r = FUNNEL_RANK[cur];
    if (Number.isFinite(r)) max = Math.max(max, r);
  }

  // Default
  if (max < 0) max = FUNNEL_RANK.sourced;
  return max;
}

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

    const subview = getDealsSubview();

    // "Active pipeline" intentionally hides:
    // - Asset Management deals (managed from Assets tab)
    // - Abandoned/archived deals (managed from Abandoned repository)
    const pipelineDeals = allDeals.filter((d) => !isAssetMgmtStage(d?.stage) && !isAbandonedDeal(d));

    const abandonedDeals = allDeals.filter((d) => isAbandonedDeal(d));

    // Funnel stats (counts deals that have ever reached each step)
    const stats = this.computeFunnelStats(allDeals);

    const totalVolume = pipelineDeals.reduce((sum, d) => sum + toNumber(d?.price, 0), 0);

    container.innerHTML = `
      <div class="p-6">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 class="text-2xl font-bold text-gray-900">Deals</h2>
            <p class="text-sm text-gray-500 font-medium">
              Pipeline: <span class="font-bold text-slate-700">${pipelineDeals.length}</span> •
              Abandoned: <span class="font-bold text-red-700">${abandonedDeals.length}</span> •
              Total tracked: <span class="font-bold text-slate-700">${allDeals.length}</span>
            </p>
          </div>

          <div class="flex items-center gap-2">
            <button data-action="deals-switch-view" data-view="pipeline"
              class="px-3 py-2 rounded-lg text-sm font-black border ${subview === 'pipeline' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'}">
              Pipeline
            </button>
            <button data-action="deals-switch-view" data-view="abandoned"
              class="px-3 py-2 rounded-lg text-sm font-black border ${subview === 'abandoned' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'}">
              Abandoned
            </button>

            <button id="add-deal-btn"
              class="bg-slate-900 text-white px-4 py-2 rounded-lg hover:bg-slate-800 font-bold shadow-sm transition-all flex items-center text-sm">
              <i class="fa fa-plus mr-2"></i>Add Deal
            </button>
          </div>
        </div>

        ${this.renderFunnelStats(stats)}

        ${
          subview === 'abandoned'
            ? this.renderAbandonedView(abandonedDeals)
            : `
              <div class="mb-3 text-sm text-gray-500 font-medium">
                Tracking ${pipelineDeals.length} active opportunities • Total Volume: ${formatters.dollars(totalVolume)}
              </div>
              <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                ${this.renderDealCards(pipelineDeals)}
              </div>
            `
        }
      </div>
    `;

    this.bindEvents();
  },

  computeFunnelStats(allDeals) {
    const dealsList = Array.isArray(allDeals) ? allDeals : [];

    const counts = {
      totalTracked: dealsList.length,
      sourced: 0,
      underwriting: 0,
      loi_sent: 0,
      counter_received: 0,
      loi_accepted: 0,
      dd_started: 0,
      closing: 0,
      asset_mgmt: 0,
      abandoned_total: 0,
      abandoned_during_dd: 0
    };

    for (const d of dealsList) {
      const maxRank = computeMaxFunnelRank(d);

      // "Ever reached" counts (based on maxRank)
      if (maxRank >= FUNNEL_RANK.sourced) counts.sourced++;
      if (maxRank >= FUNNEL_RANK.underwriting) counts.underwriting++;
      if (maxRank >= FUNNEL_RANK.loi_sent) counts.loi_sent++;
      if (maxRank >= FUNNEL_RANK.counter_received) counts.counter_received++;
      if (maxRank >= FUNNEL_RANK.loi_accepted) counts.loi_accepted++;
      if (maxRank >= FUNNEL_RANK.dd_started) counts.dd_started++;
      if (maxRank >= FUNNEL_RANK.closing) counts.closing++;
      if (maxRank >= FUNNEL_RANK.asset_mgmt) counts.asset_mgmt++;

      if (isAbandonedDeal(d)) {
        counts.abandoned_total++;
        const from = normalizeStageId(d.abandoned_from_stage || d.abandonedFromStage || '');
        if (DD_STAGE_SET.has(from)) counts.abandoned_during_dd++;
      }
    }

    return counts;
  },

  renderFunnelStats(stats) {
    const s = stats || {};

    // Compact strip — gives you quick conversion + abandonment at-a-glance
    return `
      <div class="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3 mb-6">
        <div class="bg-white border border-slate-200 rounded-xl p-3">
          <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tracked</div>
          <div class="text-lg font-black text-slate-900">${s.totalTracked ?? 0}</div>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl p-3">
          <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Underwritten</div>
          <div class="text-lg font-black text-slate-900">${s.underwriting ?? 0}</div>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl p-3">
          <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest">LOI Sent</div>
          <div class="text-lg font-black text-slate-900">${s.loi_sent ?? 0}</div>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl p-3">
          <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest">LOI Accepted</div>
          <div class="text-lg font-black text-slate-900">${s.loi_accepted ?? 0}</div>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl p-3">
          <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Closing</div>
          <div class="text-lg font-black text-slate-900">${s.closing ?? 0}</div>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl p-3">
          <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Abandoned (DD)</div>
          <div class="text-lg font-black text-red-700">${s.abandoned_during_dd ?? 0}</div>
        </div>
      </div>
    `;
  },

  renderAbandonedView(abandonedDeals) {
    const list = Array.isArray(abandonedDeals) ? abandonedDeals : [];
    return `
      <div class="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
          <div>
            <h3 class="text-lg font-black text-slate-900">Abandoned Deals</h3>
            <p class="text-xs font-semibold text-slate-500">Repository for deals you marked as abandoned (kept for stats + learning).</p>
          </div>
          <input id="abandoned-search" type="text" placeholder="Search abandoned deals…"
            class="w-full md:w-80 p-2.5 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-orange-500">
        </div>

        <div class="overflow-auto">
          <table class="min-w-full text-sm">
            <thead>
              <tr class="text-left text-xs font-black text-slate-400 uppercase tracking-widest">
                <th class="py-2 pr-3">Deal</th>
                <th class="py-2 pr-3">Abandoned From</th>
                <th class="py-2 pr-3">Reason</th>
                <th class="py-2 pr-3">Date</th>
                <th class="py-2 pr-3"></th>
              </tr>
            </thead>
            <tbody id="abandoned-tbody">
              ${this.renderAbandonedRows(list)}
            </tbody>
          </table>
        </div>

        ${list.length === 0 ? `<div class="py-10 text-center text-slate-400 font-semibold">No abandoned deals yet.</div>` : ''}
      </div>
    `;
  },

  renderAbandonedRows(list) {
    const rows = (Array.isArray(list) ? list : []).map((d) => {
      const name = escapeHtml(d?.name || 'Unnamed Deal');
      const from = stageLabel(d?.abandoned_from_stage || d?.abandonedFromStage || d?.created_from_stage || '');
      const reason = escapeHtml(d?.abandoned_reason || d?.abandonedReason || '');
      const at = d?.abandonedAt || d?.abandoned_at || '';
      const date = at ? escapeHtml(String(at).slice(0, 10)) : '';
      const id = escapeHtml(d?.id);
      return `
        <tr class="border-t border-slate-100">
          <td class="py-2 pr-3 font-black text-slate-900">${name}</td>
          <td class="py-2 pr-3 font-semibold text-slate-700">${escapeHtml(from)}</td>
          <td class="py-2 pr-3 text-slate-600">${reason || '<span class="text-slate-300">—</span>'}</td>
          <td class="py-2 pr-3 text-slate-600">${date || '<span class="text-slate-300">—</span>'}</td>
          <td class="py-2 pr-0 text-right">
            <button data-action="deal-restore" data-id="${id}"
              class="text-xs font-black text-slate-700 hover:text-emerald-700">Restore</button>
          </td>
        </tr>
      `;
    });

    return rows.join('');
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
    if (addBtn) addBtn.onclick = () => {
      setDealsSubview('pipeline');
      this.showAddDealModal();
    };

    // Abandoned search (rebounds each render)
    const search = document.getElementById('abandoned-search');
    if (search) {
      search.oninput = () => {
        const q = String(search.value || '').toLowerCase().trim();
        const list = (this._lastDeals || []).filter((d) => isAbandonedDeal(d));
        const filtered = !q
          ? list
          : list.filter((d) => {
              const name = String(d?.name || '').toLowerCase();
              const addr = String(d?.address || '').toLowerCase();
              const reason = String(d?.abandoned_reason || d?.abandonedReason || '').toLowerCase();
              const from = String(stageLabel(d?.abandoned_from_stage || d?.abandonedFromStage || '')).toLowerCase();
              return name.includes(q) || addr.includes(q) || reason.includes(q) || from.includes(q);
            });
        const tbody = document.getElementById('abandoned-tbody');
        if (tbody) tbody.innerHTML = this.renderAbandonedRows(filtered);
      };
    }

    // Delegated actions (bind once)
    if (this._bound) return;
    this._bound = true;

    container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const id = btn.dataset.id;

      if (action === 'deals-switch-view') {
        const v = btn.dataset.view || 'pipeline';
        setDealsSubview(v);
        this.render(stateManager.get());
        return;
      }

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

      if (action === 'deal-restore') {
        this.restoreDeal(id);
        return;
      }
    });
  },

  restoreDeal(id) {
    const deal = (this._lastDeals || []).find((d) => String(d?.id) === String(id));
    if (!deal) return;

    const restoreStage = normalizeStageId(deal.abandoned_from_stage || deal.abandonedFromStage || 'sourced');
    const now = isoNow();
    const hist = Array.isArray(deal.stageHistory) ? [...deal.stageHistory] : [];
    hist.push({ stage: restoreStage, at: now });

    const patch = {
      stage: restoreStage,
      stageHistory: hist,
      isArchived: false,
      archiveType: null,
      restoredAt: now,
      updated_at: now,
      updatedAt: now
    };

    stateManager.update('deals', id, patch);
    setDealsSubview('pipeline');
    router.navigate('deals');
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

    const now = isoNow();
    const prevStage = normalizeStageId(deal?.stage);

    // Update stage history
    const hist = Array.isArray(deal.stageHistory) ? [...deal.stageHistory] : [];
    if (prevStage !== 'asset_mgmt') hist.push({ stage: 'asset_mgmt', at: now });

    // Move stage to Asset Management (canonical id)
    const patch = {
      stage: 'asset_mgmt',
      stageHistory: hist,
      // Ensure it is active (not archived)
      isArchived: false,
      archiveType: null,
      updated_at: now,
      updatedAt: now
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

        // Timestamps (stateManager will also add createdAt)
        const now = isoNow();
        data.created_at = now;
        data.createdAt = now;

        // Stage history (used for funnel stats)
        data.stage = normalizeStageId(data.stage);
        data.stageHistory = [{ stage: data.stage, at: now }];

        // If created as abandoned, archive it immediately (so it stays out of the pipeline)
        if (data.stage === 'deal_abandoned') {
          data.isArchived = true;
          data.archiveType = 'abandoned';
          data.abandonedAt = now;
          data.abandoned_from_stage = 'sourced';
        }

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
        const now = isoNow();
        const patch = this.readDealFormData();

        if (!patch.name) throw new Error('Deal name is required.');

        patch.updated_at = now;
        patch.updatedAt = now;

        const prevStage = normalizeStageId(deal?.stage);
        const nextStage = normalizeStageId(patch.stage);

        // Stage history (append only when stage changes)
        const hist = Array.isArray(deal.stageHistory) ? [...deal.stageHistory] : [];
        if (prevStage !== nextStage) {
          hist.push({ stage: nextStage, at: now });
        }
        patch.stageHistory = hist;

        // Abandon behavior: archive + remove from pipeline, but keep for stats
        if (nextStage === 'deal_abandoned') {
          patch.stage = 'deal_abandoned';
          patch.isArchived = true;
          patch.archiveType = 'abandoned';
          patch.abandonedAt = deal.abandonedAt || now;
          patch.abandoned_from_stage = deal.abandoned_from_stage || prevStage;
        } else {
          // If previously abandoned and now moved back, clear archive flags
          if (isAbandonedDeal(deal)) {
            patch.isArchived = false;
            patch.archiveType = null;
            patch.restoredAt = now;
          }
        }

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
    const abandonedReason = escapeHtml(deal?.abandoned_reason || deal?.abandonedReason || '');
    const abandonedNotes = escapeHtml(deal?.abandoned_notes || deal?.abandonedNotes || '');

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

        <div class="col-span-2"><hr class="my-2 border-gray-100"></div>

        <div class="col-span-2">
          <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Abandoned Reason (optional)</label>
          <input type="text" id="deal-abandoned_reason"
            class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
            placeholder="Why did you pass? (price, seller, DD findings, debt terms...)" value="${abandonedReason}">
          <p class="text-[11px] text-slate-400 font-semibold mt-1">Tip: set stage to <span class="font-black">Deal Abandoned</span> to move it into the Abandoned repository (kept for stats).</p>
        </div>

        <div class="col-span-2">
          <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Abandoned Notes (optional)</label>
          <textarea id="deal-abandoned_notes" rows="3"
            class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
            placeholder="Any details you want to remember for next time...">${abandonedNotes}</textarea>
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
      proforma_noi: toNumber(document.getElementById('deal-proforma_noi')?.value, 0),
      abandoned_reason: String(document.getElementById('deal-abandoned_reason')?.value ?? '').trim(),
      abandoned_notes: String(document.getElementById('deal-abandoned_notes')?.value ?? '').trim()
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
