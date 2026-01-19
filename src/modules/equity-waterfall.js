/**
 * src/modules/equity-waterfall.js
 * Equity Waterfall Calculator and Visualization
 *
 * Full overwrite updates included:
 * - Rate normalization (accepts 8 or 0.08; >1 treated as percent)
 * - Hold Years support (simple pref over hold period)
 * - Deal lookup is id-type-safe (String compare)
 * - Safe division guards for bar widths
 * - Labels updated to reflect hold period
 * - Keeps existing UI structure and formatters usage
 */

import { formatters } from '../utils/formatters.js';

function toNumber(v, fallback = 0) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeRate(v, fallback) {
  // Accept 0.08 or 8 => 8%
  let r = toNumber(v, fallback);
  if (r > 1) r = r / 100;
  return r;
}

function normalizePositive(v, fallback) {
  const n = toNumber(v, fallback);
  return n > 0 ? n : fallback;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safePct(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, x));
}

/**
 * Calculates equity contributions and capital stack.
 */
function calculateCapitalStack(deal) {
  const purchase = toNumber(deal?.purchase_price ?? deal?.price, 0);
  const rehab = toNumber(deal?.total_capex ?? deal?.rehab, 0);
  const closing = toNumber(deal?.closing_costs ?? 0, 0);
  const loanAmount = toNumber(deal?.loan_amount ?? deal?.debt_amount, 0);

  const totalProjectCost = purchase + rehab + closing;
  const debtAmount = Math.min(Math.max(0, loanAmount), Math.max(0, totalProjectCost));
  const totalEquity = Math.max(0, totalProjectCost - debtAmount);

  // Prefer explicit fields if present, else assume LP supplies all equity.
  const lpEquity = toNumber(deal?.lp_equity, totalEquity);
  const gpEquity = toNumber(deal?.gp_equity, Math.max(0, totalEquity - lpEquity));

  return {
    purchase,
    rehab,
    closing,
    totalProjectCost,
    debtAmount,
    totalEquity,
    lpEquity,
    gpEquity
  };
}

/**
 * Simplified waterfall:
 * - Pref accrues as SIMPLE pref over hold period
 * - Remaining profit split between LP and GP promote
 *
 * @param {number} investedCapital - base capital for pref calc (LP by default)
 * @param {number} totalProfit - distributable profit over the hold period
 * @param {{pref_rate:any,gp_promote_percent:any,hold_years:any}} terms
 */
function calculateDistributions(investedCapital, totalProfit, terms) {
  const capital = toNumber(investedCapital, 0);
  const profit = toNumber(totalProfit, 0);

  const prefRate = normalizeRate(terms?.pref_rate, 0.08);
  const gpPromote = normalizeRate(terms?.gp_promote_percent, 0.20);
  const holdYears = normalizePositive(terms?.hold_years, 5); // allows decimals

  // Simple preferred return over hold period
  const prefAccrual = capital * prefRate * holdYears;

  const lpPref = Math.min(profit, prefAccrual);
  const remaining = Math.max(0, profit - lpPref);

  const gpPromoteAmount = remaining * gpPromote;
  const lpRemainder = remaining - gpPromoteAmount;

  return {
    holdYears,
    prefRate,
    gpPromote,

    prefAccrual,
    lpPref,
    remaining,

    lpTotal: lpPref + lpRemainder,
    gpTotal: gpPromoteAmount,
    totalProfit: profit,

    // helpful flags
    isPrefMet: profit >= prefAccrual
  };
}

export const equityWaterfall = {
  /**
   * Render the Equity Waterfall UI
   * @param {string|number} dealId
   * @param {object} state
   * @param {string} containerId
   */
  renderWaterfallUI(dealId, state, containerId = 'equity-waterfall-container') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const deals = Array.isArray(state?.deals) ? state.deals : [];
    const deal = deals.find(d => String(d?.id) === String(dealId));

    if (!deal) {
      container.innerHTML = `
        <div class="p-6 bg-white rounded-xl border border-gray-200 text-gray-500">
          <p class="font-bold">No deal selected.</p>
          <p class="text-sm">Choose a deal from the pipeline to view waterfall.</p>
        </div>
      `;
      return;
    }

    const capitalStack = calculateCapitalStack(deal);

    // Profit assumption: if you store a profit field, use it; else infer from NOI / cap / etc.
    // Keep your current approach: default to deal.total_profit or 0.
    const totalProfit = toNumber(deal?.total_profit ?? deal?.profit ?? 0, 0);

    // Terms defaults:
    // - Accept either percent or decimal from deal fields
    const terms = {
      pref_rate: deal?.pref_rate ?? deal?.pref ?? 8,                 // 8 or 0.08
      gp_promote_percent: deal?.gp_promote_percent ?? deal?.promote ?? 20, // 20 or 0.20
      hold_years: deal?.hold_years ?? deal?.holdYears ?? 5
    };

    // Pref base: LP equity by default; if you later add terms.pref_base you can toggle here
    const investedCapital = capitalStack.lpEquity;

    const dist = calculateDistributions(investedCapital, totalProfit, terms);

    const denom = Math.max(1, capitalStack.totalProjectCost);
    const debtPct = safePct((capitalStack.debtAmount / denom) * 100);
    const equityPct = safePct((capitalStack.totalEquity / denom) * 100);

    container.innerHTML = `
      <div class="p-6 space-y-6">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 class="text-2xl font-bold text-gray-900">Equity Waterfall</h2>
            <p class="text-sm text-gray-500 font-medium">
              Deal: <span class="font-black text-gray-900">${escapeHtml(deal?.name || 'Unnamed Deal')}</span>
            </p>
          </div>

          <div class="flex gap-2">
            <div class="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-black">
              Hold Years: ${escapeHtml(dist.holdYears)}
            </div>
            <div class="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-black text-slate-700">
              Pref: ${formatters.percent(dist.prefRate)}
            </div>
            <div class="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-black text-slate-700">
              Promote: ${formatters.percent(dist.gpPromote)}
            </div>
          </div>
        </div>

        <!-- Capital Stack -->
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h3 class="text-sm font-bold uppercase tracking-wider text-slate-900 mb-4">Capital Stack</h3>

          <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div class="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Cost</div>
              <div class="text-lg font-black text-slate-900">${formatters.dollars(capitalStack.totalProjectCost)}</div>
            </div>
            <div class="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Debt</div>
              <div class="text-lg font-black text-slate-900">${formatters.dollars(capitalStack.debtAmount)}</div>
            </div>
            <div class="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Equity</div>
              <div class="text-lg font-black text-slate-900">${formatters.dollars(capitalStack.totalEquity)}</div>
            </div>
            <div class="p-4 rounded-xl bg-slate-50 border border-slate-100">
              <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">LP Equity (Pref Base)</div>
              <div class="text-lg font-black text-slate-900">${formatters.dollars(capitalStack.lpEquity)}</div>
            </div>
          </div>

          <div class="mt-5">
            <div class="h-3 bg-slate-100 rounded-full overflow-hidden flex">
              <div class="h-full bg-slate-900" style="width:${debtPct}%"></div>
              <div class="h-full bg-orange-400" style="width:${equityPct}%"></div>
            </div>
            <div class="mt-2 flex justify-between text-[10px] font-black text-slate-500 uppercase">
              <span>Debt ${Math.round(debtPct)}%</span>
              <span>Equity ${Math.round(equityPct)}%</span>
            </div>
          </div>
        </div>

        <!-- Projected Distributions -->
        <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div class="flex items-start justify-between gap-4 mb-4">
            <div>
              <h3 class="text-sm font-bold uppercase tracking-wider text-slate-900">Projected Distributions (Hold Period)</h3>
              <p class="text-xs font-semibold text-slate-500">
                Simple pref over <span class="font-black text-slate-700">${escapeHtml(dist.holdYears)}</span> years
                (${formatters.percent(dist.prefRate)} annual).
              </p>
            </div>

            <div class="text-right">
              <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Profit</div>
              <div class="text-xl font-black text-slate-900">${formatters.dollars(dist.totalProfit)}</div>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="p-4 rounded-xl border border-slate-200 bg-white">
              <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Pref Accrual</div>
              <div class="text-lg font-black text-slate-900">${formatters.dollars(dist.prefAccrual)}</div>
              <div class="text-[11px] font-semibold ${dist.isPrefMet ? 'text-emerald-600' : 'text-orange-600'} mt-1">
                ${dist.isPrefMet ? 'Pref fully met' : 'Pref not fully met'}
              </div>
            </div>

            <div class="p-4 rounded-xl border border-slate-200 bg-white">
              <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">LP Total</div>
              <div class="text-lg font-black text-slate-900">${formatters.dollars(dist.lpTotal)}</div>
              <div class="text-[11px] font-semibold text-slate-500 mt-1">
                Pref: ${formatters.dollars(dist.lpPref)} • Remaining split: ${formatters.dollars(dist.lpTotal - dist.lpPref)}
              </div>
            </div>

            <div class="p-4 rounded-xl border border-slate-200 bg-white">
              <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">GP Promote</div>
              <div class="text-lg font-black text-slate-900">${formatters.dollars(dist.gpTotal)}</div>
              <div class="text-[11px] font-semibold text-slate-500 mt-1">
                Promote rate: ${formatters.percent(dist.gpPromote)}
              </div>
            </div>
          </div>

          <div class="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Waterfall Summary</div>
            <div class="text-sm font-semibold text-slate-700 space-y-1">
              <div>1) LP Pref (simple over hold): <span class="font-black">${formatters.dollars(dist.lpPref)}</span></div>
              <div>2) Remaining Profit: <span class="font-black">${formatters.dollars(dist.remaining)}</span></div>
              <div>3) Promote Split — GP: <span class="font-black">${formatters.dollars(dist.gpTotal)}</span> • LP: <span class="font-black">${formatters.dollars(dist.lpTotal - dist.lpPref)}</span></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }
};
