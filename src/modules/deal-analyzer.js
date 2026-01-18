/**
 * src/modules/deal-analyzer.js
 * Specialized module for underwriting and financial modeling.
 */

import { formatters } from '../utils/formatters.js';

export const dealAnalyzer = {
  
  /**
   * Calculates the core 1-year and multi-year metrics for a deal.
   * This logic is extracted from your computeDealAnalysis function.
   */
  analyze(deal) {
    const purchasePrice = parseFloat(deal.purchase_price) || 0;
    const grossIncome = parseFloat(deal.annual_gross_income) || 0;
    const expenses = parseFloat(deal.annual_expenses) || 0;
    const debtService = parseFloat(deal.annual_debt_service) || 0;
    const totalCapEx = parseFloat(deal.total_capex) || 0;

    const noi = grossIncome - expenses;
    const cashFlow = noi - debtService;
    const totalBasis = purchasePrice + totalCapEx;
    
    return {
      noi,
      cashFlow,
      totalBasis,
      capRate: purchasePrice > 0 ? (noi / purchasePrice) : 0,
      cashOnCash: totalBasis > 0 ? (cashFlow / totalBasis) : 0,
      yieldOnCost: totalBasis > 0 ? (noi / totalBasis) : 0
    };
  },

  /**
   * Waterfall Distribution Logic
   * Calculates splits based on preferred returns and profit shares.
   */
  calculateWaterfall(profit, terms) {
    const prefRate = parseFloat(terms.pref_rate) || 0.08;
    const gpSplit = parseFloat(terms.gp_split) || 0.20; // 20% promote
    
    // 1. Pay Preferred Return first
    const prefPayment = Math.min(profit, profit * prefRate);
    let remaining = profit - prefPayment;
    
    // 2. Split remaining based on promote
    const gpPromote = remaining > 0 ? remaining * gpSplit : 0;
    const lpShare = remaining - gpPromote;

    return {
      lpTotal: prefPayment + lpShare,
      gpTotal: gpPromote,
      total: profit
    };
  },

  /**
   * Renders the Analysis Card in the Deal View
   */
  renderAnalysis(dealId, state) {
    const deal = state.deals.find(d => d.id === dealId);
    if (!deal) return '';

    const metrics = this.analyze(deal);
    const container = document.getElementById('deal-analysis-results');
    
    if (container) {
      container.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
          <div class="bg-blue-50 p-3 rounded-lg border border-blue-100">
            <p class="text-xs text-blue-600 font-semibold uppercase">Cap Rate</p>
            <p class="text-xl font-bold text-blue-900">${formatters.percent(metrics.capRate)}</p>
          </div>
          <div class="bg-green-50 p-3 rounded-lg border border-green-100">
            <p class="text-xs text-green-600 font-semibold uppercase">Cash on Cash</p>
            <p class="text-xl font-bold text-green-900">${formatters.percent(metrics.cashOnCash)}</p>
          </div>
          <div class="bg-purple-50 p-3 rounded-lg border border-purple-100">
            <p class="text-xs text-purple-600 font-semibold uppercase">NOI (Annual)</p>
            <p class="text-xl font-bold text-purple-900">${formatters.dollars(metrics.noi)}</p>
          </div>
          <div class="bg-amber-50 p-3 rounded-lg border border-amber-100">
            <p class="text-xs text-amber-600 font-semibold uppercase">Total Basis</p>
            <p class="text-xl font-bold text-amber-900">${formatters.dollars(metrics.totalBasis)}</p>
          </div>
        </div>
      `;
    }
  }
};