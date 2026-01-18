/**
 * src/modules/deal-analyzer.js
 * Specialized module for real estate underwriting and financial modeling.
 */

import { formatters } from '../utils/formatters.js';

export const dealAnalyzer = {
  
  /**
   * Calculates the core metrics for a deal.
   */
  analyze(deal) {
    const purchasePrice = parseFloat(deal.purchase_price) || 0;
    const grossIncome = parseFloat(deal.annual_gross_income) || 0;
    const expenses = parseFloat(deal.annual_expenses) || 0;
    const debtService = parseFloat(deal.annual_debt_service) || 0;
    const totalCapEx = parseFloat(deal.total_capex) || 0;
    const loanAmount = parseFloat(deal.loan_amount) || 0;

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
   * Note: Pref is usually calculated on Unreturned Capital.
   */
  calculateWaterfall(profit, terms, investedCapital) {
    const prefRate = parseFloat(terms.pref_rate) || 0.08;
    const gpSplit = parseFloat(terms.gp_split) || 0.20; // 20% promote
    
    // 1. Calculate Preferred Return amount ($)
    const prefAccrual = investedCapital * prefRate;
    const prefPayment = Math.min(profit, prefAccrual);
    
    // 2. Split remaining cash flow
    let remaining = Math.max(0, profit - prefPayment);
    const gpPromote = remaining * gpSplit;
    const lpShare = remaining - gpPromote;

    return {
      lpTotal: prefPayment + lpShare,
      gpTotal: gpPromote,
      totalProfit: profit,
      isPrefMet: profit >= prefAccrual
    };
  },

  /**
   * Renders the Analysis Card in the Deal View
   */
  renderAnalysis(dealId, state) {
    const deal = state.deals?.find(d => d.id === dealId);
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
                  <td class="px-4 py-3 text-right font-bold text-red-600">(${formatters.dollars(parseFloat(deal.annual_debt_service) || 0)})</td>
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