/**
 * src/modules/equity-waterfall.js
 * Handles capital stacks, investment structures, and tiered distributions.
 */

import { formatters } from '../utils/formatters.js';

export const equityWaterfall = {
  
  /**
   * Calculates the core capital stack for a deal.
   */
  calculateCapitalStack(deal) {
    const purchasePrice = parseFloat(deal.purchase_price || deal.price) || 0;
    const ltv = (parseFloat(deal.ltv_percent) || 70) / 100;
    const capex = parseFloat(deal.total_capex || deal.rehab) || 0;
    const closing = parseFloat(deal.closing_costs) || 0;

    const debtAmount = purchasePrice * ltv;
    const totalEquityRequired = (purchasePrice + capex + closing) - debtAmount;
    
    // Standard GP/LP split (e.g., GP puts in 10%, LP puts in 90%)
    const gpPariPassuPercent = (parseFloat(deal.gp_investment_percent) || 10) / 100;
    const gpEquity = totalEquityRequired * gpPariPassuPercent;
    const lpEquity = totalEquityRequired * (1 - gpPariPassuPercent);

    return {
      debtAmount,
      totalEquityRequired,
      gpEquity,
      lpEquity,
      totalProjectCost: purchasePrice + capex + closing
    };
  },

  /**
   * Models a standard tiered Waterfall (Pref + Promote)
   */
  calculateDistributions(distributableCash, terms, capitalStack) {
    const prefRate = parseFloat(terms.pref_rate) / 100 || 0.08;
    const gpPromote = parseFloat(terms.gp_promote_percent) / 100 || 0.20;
    const investedCapital = capitalStack.lpEquity || 1;

    // Tier 1: Preferred Return
    const prefAccrual = investedCapital * prefRate;
    const lpPrefPayment = Math.min(distributableCash, prefAccrual);
    let remainingCash = distributableCash - lpPrefPayment;

    // Tier 2: Excess Cash split by Promote
    // Standard structure: LP gets (100% - Promote), GP gets Promote
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
   * Renders the visual Capital Stack and Waterfall summary
   */
  renderWaterfallUI(dealId, state, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const deal = state.deals?.find(d => d.id === dealId) || {};
    const stack = this.calculateCapitalStack(deal);
    
    // Default model parameters if not provided in deal
    const terms = {
      pref_rate: deal.pref_rate || 8,
      gp_promote_percent: deal.promote || 20
    };

    // Calculate distributions based on Pro-Forma NOI minus Debt Service
    const proformaCashFlow = (parseFloat(deal.proforma_noi) || 0) - (parseFloat(deal.annual_debt_service) || 0);
    const results = this.calculateDistributions(proformaCashFlow, terms, stack);

    container.innerHTML = `
      <div class="space-y-6">
        <div>
          <h4 class="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Capital Stack</h4>
          <div class="flex h-8 w-full rounded-full overflow-hidden border border-gray-100 shadow-inner">
            <div class="bg-slate-800 h-full flex items-center justify-center text-[10px] text-white font-bold" style="width: ${(stack.debtAmount / stack.totalProjectCost * 100).toFixed(0)}%">
              DEBT
            </div>
            <div class="bg-blue-500 h-full flex items-center justify-center text-[10px] text-white font-bold" style="width: ${(stack.lpEquity / stack.totalProjectCost * 100).toFixed(0)}%">
              LP
            </div>
            <div class="bg-orange-500 h-full flex items-center justify-center text-[10px] text-white font-bold" style="width: ${(stack.gpEquity / stack.totalProjectCost * 100).toFixed(0)}%">
              GP
            </div>
          </div>
          <div class="flex justify-between mt-2 text-[10px] font-bold text-slate-500 uppercase">
             <span>Debt: ${formatters.compact(stack.debtAmount)}</span>
             <span>LP: ${formatters.compact(stack.lpEquity)}</span>
             <span>GP: ${formatters.compact(stack.gpEquity)}</span>
          </div>
        </div>

        

        <div class="bg-white rounded-xl p-5 border border-slate-200">
          <div class="flex justify-between items-center mb-4">
            <h4 class="text-sm font-bold text-slate-900">Projected Distributions (Year 1)</h4>
            <span class="px-2 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase">
                Cash Flow: ${formatters.dollars(proformaCashFlow)}
            </span>
          </div>
          
          <div class="space-y-3">
            <div class="flex justify-between text-sm">
              <span class="text-slate-500 italic">LP Pref Return (${terms.pref_rate}%):</span>
              <span class="font-bold text-slate-900">${formatters.dollars(results.breakdown.pref)}</span>
            </div>
            <div class="flex justify-between text-sm">
              <span class="text-slate-500 italic">GP Promote (${terms.gp_promote_percent}% of Excess):</span>
              <span class="font-bold text-orange-600">${formatters.dollars(results.gpTotal)}</span>
            </div>
            <div class="flex justify-between text-sm pb-3 border-b border-slate-50">
              <span class="text-slate-500 italic">LP Residual Share:</span>
              <span class="font-bold text-slate-900">${formatters.dollars(results.breakdown.excessLp)}</span>
            </div>
            
            <div class="flex justify-between items-center pt-2">
              <div>
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Total LP Distribution</p>
                <p class="text-xl font-black text-blue-600">${formatters.dollars(results.lpTotal)}</p>
              </div>
              <div class="text-right">
                <p class="text-[10px] font-black text-slate-400 uppercase tracking-tighter">LP Cash-on-Cash</p>
                <p class="text-xl font-black text-slate-900">${((results.lpTotal / stack.lpEquity) * 100).toFixed(2)}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
};