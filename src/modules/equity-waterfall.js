/**
 * src/modules/equity-waterfall.js
 * Handles the logic for capital stacks and investor distributions.
 */

import { formatters } from '../utils/formatters.js';

// RENAME THIS from waterfallManager to equityWaterfall to match main.js
export const equityWaterfall = {
  
  /**
   * Calculates the core capital stack for a deal.
   */
  calculateCapitalStack(deal) {
    const purchasePrice = parseFloat(deal.purchase_price) || 0;
    const ltv = parseFloat(deal.ltv_percent) / 100 || 0.70;
    
    const debtAmount = purchasePrice * ltv;
    const totalEquityRequired = purchasePrice - debtAmount + (parseFloat(deal.total_capex) || 0);
    
    const gpEquity = totalEquityRequired * 0.10;
    const lpEquity = totalEquityRequired * 0.90;

    return {
      debtAmount,
      totalEquityRequired,
      gpEquity,
      lpEquity
    };
  },

  /**
   * Models a standard 2-tier Waterfall
   */
  calculateDistributions(distributableCash, terms) {
    const prefRate = parseFloat(terms.pref_rate) || 0.08;
    const gpPromote = parseFloat(terms.gp_promote_percent) / 100 || 0.20;
    const totalLpCapital = parseFloat(terms.total_lp_capital) || 1;

    const prefAmount = totalLpCapital * prefRate;
    const lpPrefPayment = Math.min(distributableCash, prefAmount);
    let remainingCash = distributableCash - lpPrefPayment;

    let lpExcess = 0;
    let gpPromotePayment = 0;

    if (remainingCash > 0) {
      gpPromotePayment = remainingCash * gpPromote;
      lpExcess = remainingCash - gpPromotePayment;
    }

    return {
      lpTotal: lpPrefPayment + lpExcess,
      gpTotal: gpPromotePayment,
      remaining: Math.max(0, remainingCash),
      breakdown: {
        pref: lpPrefPayment,
        promote: gpPromotePayment,
        excessLp: lpExcess
      }
    };
  },

  /**
   * Renders the Waterfall Summary Table
   */
  renderWaterfallUI(dealId, state, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const mockTerms = { pref_rate: 0.08, gp_promote_percent: 20, total_lp_capital: 1000000 };
    const mockProfit = 250000;

    const result = this.calculateDistributions(mockProfit, mockTerms);

    container.innerHTML = `
      <div class="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <h4 class="text-sm font-bold text-gray-700 mb-4">Waterfall Distribution Model</h4>
        <div class="space-y-3">
          <div class="flex justify-between text-sm">
            <span class="text-gray-500">Distributable Cash:</span>
            <span class="font-semibold">${formatters.dollars(mockProfit)}</span>
          </div>
          <div class="flex justify-between text-sm border-b pb-2">
            <span class="text-gray-500">LP Preferred Return (8%):</span>
            <span class="text-green-600 font-medium">+${formatters.dollars(result.breakdown.pref)}</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-gray-500">GP Promote (20% of Excess):</span>
            <span class="text-blue-600 font-medium">${formatters.dollars(result.gpTotal)}</span>
          </div>
          <div class="flex justify-between text-sm">
            <span class="text-gray-500">LP Residual Share:</span>
            <span class="text-green-600 font-medium">${formatters.dollars(result.breakdown.excessLp)}</span>
          </div>
          <div class="pt-2 border-t flex justify-between font-bold text-gray-900">
            <span>Total to LP:</span>
            <span>${formatters.dollars(result.lpTotal)}</span>
          </div>
        </div>
      </div>
    `;
  }
};