/**
 * src/modules/deal-analyzer.js
 * Specialized module for real estate underwriting and financial modeling.
 */

import { formatters } from '../utils/formatters.js';
import { stateManager } from '../state.js';

function toNumber(v, fallback = 0) {
  const n = parseFloat(v);
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

export const dealAnalyzer = {
  _bound: false,
  _activeDealId: null,

  _getSelectedDealId() {
    // Deals list sets this when clicking "Analyze"
    try {
      const id = sessionStorage.getItem('selected_deal_id');
      return id ? String(id) : null;
    } catch (_) {
      return null;
    }
  },

  _escapeHtml(s) {
    return String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  },

  _prefillValue(deal, keys, fallback = '') {
    for (const k of keys) {
      const v = deal?.[k];
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    return fallback;
  },

  _bindOnce() {
    if (this._bound) return;
    this._bound = true;

    document.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      if (btn.dataset.action !== 'deal-analyzer-run') return;

      const container = document.getElementById('view-deal-analyzer');
      if (!container) return;

      const dealId = btn.dataset.dealId || this._getSelectedDealId();
      const state = stateManager.get();
      const deal = (state.deals || []).find(d => String(d.id) === String(dealId));
      if (!deal) return;

      const form = container.querySelector('#dealAnalyzerForm');
      if (!form) return;

      // Read inputs
      const patch = {
        purchase_price: toNumber(form.querySelector('#da_purchase_price')?.value, 0),
        annual_gross_income: toNumber(form.querySelector('#da_annual_gross_income')?.value, 0),
        annual_expenses: toNumber(form.querySelector('#da_annual_expenses')?.value, 0),
        annual_debt_service: toNumber(form.querySelector('#da_annual_debt_service')?.value, 0),
        total_capex: toNumber(form.querySelector('#da_total_capex')?.value, 0),
        loan_amount: toNumber(form.querySelector('#da_loan_amount')?.value, 0)
      };

      // Persist analyzer fields onto the deal (non-destructive; these keys are analyzer-specific)
      stateManager.update('deals', deal.id, patch);

      // Render results immediately
      const nextState = stateManager.get();
      this.render(nextState);
    });

    // If a deal is selected from the Deals view, re-render analyzer
    window.addEventListener('deal-analyzer:select', (e) => {
      const id = e?.detail?.id;
      if (!id) return;
      this._activeDealId = String(id);
      this.render(stateManager.get());
    });
  },

  /**
   * Renders the Deal Analyzer View.
   * Shows a simple underwriting form + computed outputs.
   */
  render(state = stateManager.get()) {
    this._bindOnce();

    const container = document.getElementById('view-deal-analyzer');
    if (!container) return;

    const selectedId = this._activeDealId || this._getSelectedDealId();
    const deal = (state.deals || []).find(d => String(d.id) === String(selectedId));

    if (!deal) {
      container.innerHTML = `
        <div class="p-6 max-w-5xl mx-auto">
          <div class="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h2 class="text-xl font-black text-slate-900 italic tracking-tight">Deal Analyzer</h2>
            <p class="text-sm text-slate-500 font-semibold mt-1">Select a deal from the Deals tab and click <span class="font-black">Analyze</span>.</p>
          </div>
        </div>
      `;
      return;
    }

    // Prefill with analyzer-specific keys first, then fall back to legacy deal keys.
    const vPurchase = this._prefillValue(deal, ['purchase_price', 'price', 'purchasePrice'], '');
    const vIncome = this._prefillValue(deal, ['annual_gross_income', 'gross_income', 'annual_income', 'grossIncome'], '');
    const vExpenses = this._prefillValue(deal, ['annual_expenses', 'expenses', 'annualExpense'], '');
    const vDebt = this._prefillValue(deal, ['annual_debt_service', 'debt_service', 'annualDebtService'], '');
    const vCapex = this._prefillValue(deal, ['total_capex', 'rehab', 'capex', 'totalCapex'], '');
    const vLoan = this._prefillValue(deal, ['loan_amount', 'loan', 'loanAmount'], '');

    const metrics = this.analyze(deal);

    container.innerHTML = `
      <div class="p-6 max-w-6xl mx-auto space-y-6">
        <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h2 class="text-2xl font-black text-slate-900 italic tracking-tight">Deal Analyzer</h2>
            <p class="text-sm text-slate-500 font-semibold">Underwrite quickly, then save inputs back to the deal.</p>
          </div>
          <div class="text-right">
            <div class="text-sm font-black text-slate-900">${this._escapeHtml(deal?.name || 'Unnamed Deal')}</div>
            <div class="text-xs font-semibold text-slate-500">${this._escapeHtml(deal?.address || '')}</div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div class="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div class="flex items-center justify-between mb-3">
              <div class="text-sm font-black text-slate-900">Inputs</div>
              <button data-action="deal-analyzer-run" data-deal-id="${this._escapeHtml(deal.id)}"
                class="px-4 py-2 rounded-xl bg-orange-600 text-white text-sm font-black hover:bg-orange-700">
                Run analysis
              </button>
            </div>

            <form id="dealAnalyzerForm" class="space-y-3">
              ${this._inputRow('Purchase price', 'da_purchase_price', vPurchase, 'e.g. 2500000')}
              ${this._inputRow('Annual gross income', 'da_annual_gross_income', vIncome, 'e.g. 420000')}
              ${this._inputRow('Annual expenses', 'da_annual_expenses', vExpenses, 'e.g. 160000')}
              ${this._inputRow('Annual debt service', 'da_annual_debt_service', vDebt, 'e.g. 210000')}
              ${this._inputRow('Total CapEx', 'da_total_capex', vCapex, 'e.g. 350000')}
              ${this._inputRow('Loan amount', 'da_loan_amount', vLoan, 'e.g. 1750000')}
            </form>

            <p class="text-[11px] font-semibold text-slate-400 mt-4">Tip: The analyzer saves these fields onto the deal so they sync with Firestore.</p>
          </div>

          <div class="lg:col-span-3 space-y-6">
            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
              ${this._metricCard('Cap Rate', formatters.percent(metrics.capRate))}
              ${this._metricCard('Cash on Cash', formatters.percent(metrics.cashOnCash))}
              ${this._metricCard('Yield on Cost', formatters.percent(metrics.yieldOnCost))}
              ${this._metricCard('DSCR', `${metrics.debtServiceCoverage.toFixed(2)}x`)}
            </div>

            <div class="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <table class="w-full text-left text-sm">
                <thead class="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th class="px-4 py-3 font-black text-slate-700">Line item</th>
                    <th class="px-4 py-3 font-black text-slate-700 text-right">Annual value</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <tr>
                    <td class="px-4 py-3 text-slate-600">Net Operating Income (NOI)</td>
                    <td class="px-4 py-3 text-right font-black text-slate-900">${formatters.dollars(metrics.noi)}</td>
                  </tr>
                  <tr>
                    <td class="px-4 py-3 text-slate-600">Annual Debt Service</td>
                    <td class="px-4 py-3 text-right font-black text-red-600">(${formatters.dollars(toNumber(deal.annual_debt_service, 0))})</td>
                  </tr>
                  <tr class="bg-emerald-50/30">
                    <td class="px-4 py-3 font-black text-emerald-900">Net Cash Flow</td>
                    <td class="px-4 py-3 text-right font-black text-emerald-700">${formatters.dollars(metrics.cashFlow)}</td>
                  </tr>
                  <tr>
                    <td class="px-4 py-3 text-slate-600">Total Basis</td>
                    <td class="px-4 py-3 text-right font-black text-slate-900">${formatters.dollars(metrics.totalBasis)}</td>
                  </tr>
                  <tr>
                    <td class="px-4 py-3 text-slate-600">Equity Required</td>
                    <td class="px-4 py-3 text-right font-black text-blue-700">${formatters.dollars(metrics.equityRequired)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  _inputRow(label, id, value, placeholder = '') {
    return `
      <div>
        <label class="block text-xs font-black text-slate-600 mb-1">${this._escapeHtml(label)}</label>
        <input id="${this._escapeHtml(id)}" type="number" inputmode="decimal" step="any"
          value="${this._escapeHtml(value)}" placeholder="${this._escapeHtml(placeholder)}"
          class="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all" />
      </div>
    `;
  },

  _metricCard(label, value) {
    return `
      <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <p class="text-[10px] text-slate-500 font-black uppercase tracking-wider mb-1">${this._escapeHtml(label)}</p>
        <p class="text-2xl font-black text-slate-900">${this._escapeHtml(value)}</p>
      </div>
    `;
  },

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

    // Core Calculations
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
   * Note: This is a simplified model:
   * - Pref is calculated as SIMPLE (non-compounding) over "Hold Years"
   * - Does not model return of capital tiers or IRR hurdles
   *
   * @param {number} profit - Total distributable profit (over the hold period)
   * @param {object} terms - { pref_rate, gp_split, hold_years, ... }
   * @param {number} investedCapital - LP invested capital (or total capital base for pref calc)
   */
  calculateWaterfall(profit, terms = {}, investedCapital = 0) {
    const totalProfit = toNumber(profit, 0);
    const capital = toNumber(investedCapital, 0);

    // Normalize inputs (accept 8 or 0.08)
    const prefRate = normalizeRate(terms.pref_rate, 0.08);
    const gpSplit = normalizeRate(terms.gp_split, 0.20);

    // Hold years (default 5). Allows decimals (e.g., 3.5 years)
    const holdYears = normalizePositive(terms.hold_years, 5);

    // 1) Preferred Return amount over hold period (simple pref)
    const prefAccrual = capital * prefRate * holdYears;

    // Pay pref first (up to available profit)
    const prefPayment = Math.min(totalProfit, prefAccrual);

    // 2) Split remaining profit as promote
    const remaining = Math.max(0, totalProfit - prefPayment);
    const gpPromote = remaining * gpSplit;
    const lpShare = remaining - gpPromote;

    return {
      // Totals
      lpTotal: prefPayment + lpShare,
      gpTotal: gpPromote,
      totalProfit,

      // Diagnostics (helps UI/debugging; safe additive fields)
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
   * Renders the Analysis Card in the Deal View
   */
  renderAnalysis(dealId, state) {
    const deal = state.deals?.find(d => String(d.id) === String(dealId));
    if (!deal) return;

    const metrics = this.analyze(deal);
    const container = document.getElementById('deal-analysis-results');

    if (container) {
      container.innerHTML = `
        <div class="space-y-6">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div class="bg-blue-50 p-4 rounded-xl border border-blue-100 shadow-sm">
              <p class="text-[10px] text-blue-600 font-bold uppercase tracking-wider mb-1">Cap Rate</p>
              <p class="text-2xl font-black text-blue-900">${formatters.percent(metrics.capRate)}</p>
            </div>
            <div class="bg-emerald-50 p-4 rounded-xl border border-emerald-100 shadow-sm">
              <p class="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-1">Cash on Cash</p>
              <p class="text-2xl font-black text-emerald-900">${formatters.percent(metrics.cashOnCash)}</p>
            </div>
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 shadow-sm">
              <p class="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Yield on Cost</p>
              <p class="text-2xl font-black text-slate-900">${formatters.percent(metrics.yieldOnCost)}</p>
            </div>
            <div class="bg-orange-50 p-4 rounded-xl border border-orange-100 shadow-sm">
              <p class="text-[10px] text-orange-600 font-bold uppercase tracking-wider mb-1">DSCR</p>
              <p class="text-2xl font-black text-orange-900">${metrics.debtServiceCoverage.toFixed(2)}x</p>
            </div>
          </div>

          <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <table class="w-full text-left text-sm">
              <thead class="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th class="px-4 py-3 font-bold text-gray-700">Financial Line Item</th>
                  <th class="px-4 py-3 font-bold text-gray-700 text-right">Annual Value</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100">
                <tr>
                  <td class="px-4 py-3 text-gray-600">Net Operating Income (NOI)</td>
                  <td class="px-4 py-3 text-right font-bold text-gray-900">${formatters.dollars(metrics.noi)}</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 text-gray-600">Annual Debt Service</td>
                  <td class="px-4 py-3 text-right font-bold text-red-600">(${formatters.dollars(toNumber(deal.annual_debt_service, 0))})</td>
                </tr>
                <tr class="bg-emerald-50/30">
                  <td class="px-4 py-3 font-bold text-emerald-900">Net Cash Flow</td>
                  <td class="px-4 py-3 text-right font-bold text-emerald-700">${formatters.dollars(metrics.cashFlow)}</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 text-gray-600">Total Basis (Cost)</td>
                  <td class="px-4 py-3 text-right font-bold text-gray-900">${formatters.dollars(metrics.totalBasis)}</td>
                </tr>
                <tr>
                  <td class="px-4 py-3 text-gray-600">Equity Requirement</td>
                  <td class="px-4 py-3 text-right font-bold text-blue-700">${formatters.dollars(metrics.equityRequired)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
    }
  }
};
