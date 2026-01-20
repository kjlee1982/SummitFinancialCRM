/**
 * src/modules/deal-analyzer.js
 * Deal Analyzer view + underwriting math.
 *
 * This view can:
 *  - Run quick underwriting metrics.
 *  - Save (or update) the deal into the Deals Pipeline (state.deals).
 */

import { stateManager } from '../state.js';
import { router } from '../router.js';
import { formatters } from '../utils/formatters.js';
import { modalManager } from '../utils/modals.js';

function toNumber(v, fallback = 0) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function toInt(v, fallback = 0) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeRate(v, fallback) {
  // Accepts 0.08 or 8 (meaning 8%). Converts >1 to percent form.
  let r = toNumber(v, fallback);
  if (r > 1) r = r / 100;
  return r;
}

function normalizePositive(v, fallback) {
  const n = toNumber(v, fallback);
  return n > 0 ? n : fallback;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getSelectedDealId() {
  try {
    return sessionStorage.getItem('selected_deal_id') || null;
  } catch (_) {
    return null;
  }
}

function setSelectedDealId(id) {
  try {
    sessionStorage.setItem('selected_deal_id', String(id));
  } catch (_) {}
}

function pick(obj, keys) {
  const out = {};
  keys.forEach(k => {
    if (obj?.[k] !== undefined) out[k] = obj[k];
  });
  return out;
}

export const dealAnalyzer = {
  /**
   * Calculates the core metrics for a deal.
   */
  analyze(deal) {
    const purchasePrice = toNumber(deal.purchase_price, 0);
    const grossIncome = toNumber(deal.annual_gross_income, 0);
    const expenses = toNumber(deal.annual_expenses, 0);
    const debtService = toNumber(deal.annual_debt_service, 0);
    const totalCapEx = toNumber(deal.total_capex, 0);
    const loanAmount = toNumber(deal.loan_amount, 0);

    const noi = grossIncome - expenses;
    const cashFlow = noi - debtService;
    const totalBasis = purchasePrice + totalCapEx;
    const equityRequired = totalBasis - loanAmount;

    return {
      noi,
      cashFlow,
      totalBasis,
      equityRequired,
      capRate: purchasePrice > 0 ? (noi / purchasePrice) : 0,
      cashOnCash: equityRequired > 0 ? (cashFlow / equityRequired) : 0,
      yieldOnCost: totalBasis > 0 ? (noi / totalBasis) : 0,
      ltc: totalBasis > 0 ? (loanAmount / totalBasis) : 0,
      debtServiceCoverage: debtService > 0 ? (noi / debtService) : 0
    };
  },

  /**
   * Waterfall Distribution Logic (Standard Pref + Promote)
   * Note: simplified (simple pref, no IRR hurdles).
   */
  calculateWaterfall(profit, terms = {}, investedCapital = 0) {
    const totalProfit = toNumber(profit, 0);
    const capital = toNumber(investedCapital, 0);

    const prefRate = normalizeRate(terms.pref_rate, 0.08);
    const gpSplit = normalizeRate(terms.gp_split, 0.20);
    const holdYears = normalizePositive(terms.hold_years, 5);

    const prefAccrual = capital * prefRate * holdYears;
    const prefPayment = Math.min(totalProfit, prefAccrual);

    const remaining = Math.max(0, totalProfit - prefPayment);
    const gpPromote = remaining * gpSplit;
    const lpShare = remaining - gpPromote;

    return {
      lpTotal: prefPayment + lpShare,
      gpTotal: gpPromote,
      totalProfit,
      holdYears,
      prefRate,
      gpSplit,
      prefAccrual,
      prefPayment,
      remaining,
      isPrefMet: totalProfit >= prefAccrual
    };
  },

  /**
   * Standalone view renderer.
   * - If selected_deal_id exists, loads that deal for editing.
   * - Otherwise acts as a "new underwriting" screen.
   */
  render() {
    const host = document.getElementById('view-deal-analyzer');
    if (!host) return;

    const state = stateManager.get();
    const selectedId = getSelectedDealId();
    const existing = selectedId
      ? (state.deals || []).find(d => String(d?.id) === String(selectedId))
      : null;

    // Defaults (support both "pipeline" fields and analyzer fields)
    const initial = {
      id: existing?.id || '',
      name: existing?.name || '',
      address: existing?.address || '',
      units: existing?.units ?? '',
      stage: existing?.stage || 'Sourced',

      // Analyzer core
      purchase_price: existing?.purchase_price ?? existing?.price ?? '',
      total_capex: existing?.total_capex ?? existing?.rehab ?? '',
      closing_costs: existing?.closing_costs ?? '',
      loan_amount: existing?.loan_amount ?? '',
      annual_gross_income: existing?.annual_gross_income ?? '',
      annual_expenses: existing?.annual_expenses ?? '',
      annual_debt_service: existing?.annual_debt_service ?? '',
    };

    host.innerHTML = `
      <div class="max-w-6xl mx-auto p-6">
        <div class="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div class="text-xs font-black uppercase tracking-widest text-slate-400">Tools</div>
            <h1 class="text-2xl font-black text-slate-900 tracking-tight">Deal Analyzer</h1>
            <div class="text-sm font-semibold text-slate-500 mt-1">
              Run underwriting and <span class="font-black text-slate-700">save to Deal Pipeline</span>.
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button id="da-run" class="px-4 py-2 rounded-xl bg-white border border-slate-200 font-black text-slate-800 hover:bg-slate-50">
              <i class="fa fa-play mr-2"></i>Run Analysis
            </button>
            <button id="da-save" class="px-4 py-2 rounded-xl bg-slate-900 text-white font-black hover:bg-slate-800">
              <i class="fa fa-floppy-disk mr-2"></i>${existing ? 'Update Deal' : 'Save to Pipeline'}
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <div class="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="px-5 py-4 border-b border-slate-200 bg-slate-50">
              <div class="text-sm font-black text-slate-900">Inputs</div>
              <div class="text-xs font-semibold text-slate-500">These fields will be stored on the Deal when you save.</div>
            </div>

            <div class="p-5">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                ${this._input('da_name', 'Deal Name', initial.name)}
                ${this._input('da_address', 'Address', initial.address)}
                ${this._input('da_units', 'Units', initial.units, 'number')}

                ${this._select('da_stage', 'Pipeline Stage', initial.stage, [
                  'Sourced','Underwriting','LOI Sent','Counter Received','LOI Accepted','Awaiting DD Docs',
                  'Due Diligence Started','DD LOI Modifications Needed','Offer Accepted','Closing','Closed','Asset Mgmt'
                ])}

                ${this._money('da_purchase_price', 'Purchase Price', initial.purchase_price)}
                ${this._money('da_total_capex', 'CapEx / Rehab', initial.total_capex)}
                ${this._money('da_closing_costs', 'Closing Costs', initial.closing_costs)}
                ${this._money('da_loan_amount', 'Loan Amount', initial.loan_amount)}
                ${this._money('da_annual_gross_income', 'Annual Gross Income', initial.annual_gross_income)}
                ${this._money('da_annual_expenses', 'Annual Expenses', initial.annual_expenses)}
                ${this._money('da_annual_debt_service', 'Annual Debt Service', initial.annual_debt_service)}
              </div>

              <div class="mt-5 text-xs font-semibold text-slate-500">
                Tip: If you want this saved deal to appear in the pipeline immediately, click <span class="font-black">Save to Pipeline</span>.
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div class="px-5 py-4 border-b border-slate-200 bg-slate-50">
              <div class="text-sm font-black text-slate-900">Results</div>
              <div class="text-xs font-semibold text-slate-500">Run analysis to populate metrics.</div>
            </div>
            <div class="p-5" id="deal-analysis-results">
              <div class="text-sm font-semibold text-slate-500">No results yet.</div>
            </div>
          </div>
        </div>
      </div>
    `;

    const runBtn = document.getElementById('da-run');
    const saveBtn = document.getElementById('da-save');

    runBtn?.addEventListener('click', () => {
      const deal = this._readFormIntoDeal();
      const metrics = this.analyze(deal);
      this._renderMetrics(metrics);
    });

    saveBtn?.addEventListener('click', async () => {
      const deal = this._readFormIntoDeal();
      if (!deal.name) {
        modalManager.alert({ title: 'Missing name', message: 'Please enter a Deal Name before saving.' });
        return;
      }

      // Save into pipeline schema + keep analyzer fields (so we can re-open and edit later)
      const pipelinePatch = {
        name: deal.name,
        address: deal.address,
        stage: deal.stage || 'Sourced',
        units: deal.units,

        // Pipeline cards use these
        price: deal.purchase_price,
        rehab: deal.total_capex,
        closing_costs: deal.closing_costs,
        proforma_noi: this.analyze(deal).noi,

        // Keep analyzer fields too
        ...pick(deal, [
          'purchase_price','total_capex','closing_costs','loan_amount',
          'annual_gross_income','annual_expenses','annual_debt_service'
        ])
      };

      const currentState = stateManager.get();
      const selected = getSelectedDealId();
      const exists = selected && (currentState.deals || []).some(d => String(d?.id) === String(selected));

      if (exists) {
        await stateManager.update('deals', String(selected), pipelinePatch);
        modalManager.alert({ title: 'Deal updated', message: 'Saved to Deal Pipeline.' });
      } else {
        await stateManager.add('deals', pipelinePatch);

        // stateManager.add() prepends new items, so newest is index 0
        const newId = stateManager.get()?.deals?.[0]?.id;
        if (newId) setSelectedDealId(newId);

        modalManager.alert({ title: 'Deal saved', message: 'Saved to Deal Pipeline.' });
      }

      router.navigate('deals');
    });
  },

  // ----------------------
  // Internal UI helpers
  // ----------------------
  _input(id, label, value = '', type = 'text') {
    return `
      <div>
        <label class="text-[11px] font-black uppercase tracking-widest text-slate-500" for="${id}">${escapeHtml(label)}</label>
        <input id="${id}" type="${type}" value="${escapeHtml(value)}"
          class="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-400" />
      </div>
    `;
  },

  _select(id, label, value, options = []) {
    const opts = (options || []).map(o => {
      const sel = String(o) === String(value) ? 'selected' : '';
      return `<option value="${escapeHtml(o)}" ${sel}>${escapeHtml(o)}</option>`;
    }).join('');

    return `
      <div>
        <label class="text-[11px] font-black uppercase tracking-widest text-slate-500" for="${id}">${escapeHtml(label)}</label>
        <select id="${id}" class="mt-1 w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-400">
          ${opts}
        </select>
      </div>
    `;
  },

  _money(id, label, value = '') {
    return this._input(id, label, value, 'number');
  },

  _readFormIntoDeal() {
    return {
      name: document.getElementById('da_name')?.value?.trim() || '',
      address: document.getElementById('da_address')?.value?.trim() || '',
      stage: document.getElementById('da_stage')?.value?.trim() || 'Sourced',
      units: toInt(document.getElementById('da_units')?.value, 0),

      purchase_price: toNumber(document.getElementById('da_purchase_price')?.value, 0),
      total_capex: toNumber(document.getElementById('da_total_capex')?.value, 0),
      closing_costs: toNumber(document.getElementById('da_closing_costs')?.value, 0),
      loan_amount: toNumber(document.getElementById('da_loan_amount')?.value, 0),
      annual_gross_income: toNumber(document.getElementById('da_annual_gross_income')?.value, 0),
      annual_expenses: toNumber(document.getElementById('da_annual_expenses')?.value, 0),
      annual_debt_service: toNumber(document.getElementById('da_annual_debt_service')?.value, 0)
    };
  },

  _renderMetrics(metrics) {
    const container = document.getElementById('deal-analysis-results');
    if (!container) return;

    container.innerHTML = `
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-3">
          <div class="p-3 rounded-2xl bg-blue-50 border border-blue-100">
            <div class="text-[10px] font-black uppercase tracking-widest text-blue-600">Cap Rate</div>
            <div class="text-xl font-black text-blue-900">${formatters.percent(metrics.capRate)}</div>
          </div>
          <div class="p-3 rounded-2xl bg-emerald-50 border border-emerald-100">
            <div class="text-[10px] font-black uppercase tracking-widest text-emerald-600">Cash-on-Cash</div>
            <div class="text-xl font-black text-emerald-900">${formatters.percent(metrics.cashOnCash)}</div>
          </div>
          <div class="p-3 rounded-2xl bg-slate-50 border border-slate-200">
            <div class="text-[10px] font-black uppercase tracking-widest text-slate-500">Yield on Cost</div>
            <div class="text-xl font-black text-slate-900">${formatters.percent(metrics.yieldOnCost)}</div>
          </div>
          <div class="p-3 rounded-2xl bg-orange-50 border border-orange-100">
            <div class="text-[10px] font-black uppercase tracking-widest text-orange-600">DSCR</div>
            <div class="text-xl font-black text-orange-900">${Number(metrics.debtServiceCoverage || 0).toFixed(2)}x</div>
          </div>
        </div>

        <div class="rounded-2xl border border-slate-200 overflow-hidden">
          <div class="px-4 py-3 bg-slate-50 border-b border-slate-200">
            <div class="text-[11px] font-black uppercase tracking-widest text-slate-500">Key Figures</div>
          </div>
          <div class="p-4 space-y-2 text-sm">
            <div class="flex justify-between"><span class="font-semibold text-slate-600">NOI</span><span class="font-black text-slate-900">${formatters.dollars(metrics.noi)}</span></div>
            <div class="flex justify-between"><span class="font-semibold text-slate-600">Cash Flow</span><span class="font-black text-slate-900">${formatters.dollars(metrics.cashFlow)}</span></div>
            <div class="flex justify-between"><span class="font-semibold text-slate-600">Total Basis</span><span class="font-black text-slate-900">${formatters.dollars(metrics.totalBasis)}</span></div>
            <div class="flex justify-between"><span class="font-semibold text-slate-600">Equity Required</span><span class="font-black text-slate-900">${formatters.dollars(metrics.equityRequired)}</span></div>
            <div class="flex justify-between"><span class="font-semibold text-slate-600">LTC</span><span class="font-black text-slate-900">${formatters.percent(metrics.ltc)}</span></div>
          </div>
        </div>
      </div>
    `;
  }
};
