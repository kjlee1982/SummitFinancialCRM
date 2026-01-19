/**
 * src/modules/deal-analyzer.js
 * Specialized module for real estate underwriting and financial modeling.
 */

import { formatters } from '../utils/formatters.js';

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
