/**
 * src/utils/calculations.js
 * Centralized financial engine for Real Estate metrics.
 */

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function roundTo(n, decimals) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  const p = 10 ** decimals;
  return Math.round(x * p) / p;
}

export const calc = {
  /**
   * Total Project Cost (Basis)
   */
  totalBasis(purchasePrice, closingCosts, rehabBudget) {
    return num(purchasePrice) + num(closingCosts) + num(rehabBudget);
  },

  /**
   * Cap Rate = (NOI / Purchase Price) * 100
   */
  capRate(noi, price) {
    const p = num(price);
    if (p <= 0) return 0;
    return roundTo((num(noi) / p) * 100, 2);
  },

  /**
   * Yield on Cost = (Projected NOI / Total Project Cost) * 100
   */
  yieldOnCost(projectedNoi, totalBasis) {
    const b = num(totalBasis);
    if (b <= 0) return 0;
    return roundTo((num(projectedNoi) / b) * 100, 2);
  },

  /**
   * Debt Service Coverage Ratio (DSCR)
   */
  dscr(noi, annualDebtService) {
    const ds = num(annualDebtService);
    if (ds <= 0) return 0;
    return roundTo(num(noi) / ds, 2);
  },

  /**
   * Loan to Value (LTV)
   */
  ltv(loanAmount, valuation) {
    const v = num(valuation);
    if (v <= 0) return 0;
    return roundTo((num(loanAmount) / v) * 100, 1);
  },

  /**
   * Cash-on-Cash Return
   * (Annual Pre-Tax Cash Flow / Total Equity Invested)
   */
  cashOnCash(cashFlow, equity) {
    const e = num(equity);
    if (e <= 0) return 0;
    return roundTo((num(cashFlow) / e) * 100, 2);
  },

  /**
   * Per Unit Metrics
   */
  pricePerUnit(price, units) {
    const u = num(units);
    if (u <= 0) return 0;
    return Math.round(num(price) / u);
  }
};
