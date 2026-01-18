/**
 * src/utils/calculations.js
 * Centralized financial engine for Real Estate metrics.
 */

export const calc = {
    /**
     * Total Project Cost (Basis)
     */
    totalBasis(purchasePrice, closingCosts, rehabBudget) {
        return (parseFloat(purchasePrice) || 0) + 
               (parseFloat(closingCosts) || 0) + 
               (parseFloat(rehabBudget) || 0);
    },

    /**
     * Cap Rate = (NOI / Purchase Price) * 100
     */
    capRate(noi, price) {
        if (!price || price <= 0) return 0;
        return ((noi / price) * 100).toFixed(2);
    },

    /**
     * Yield on Cost = (Projected NOI / Total Project Cost) * 100
     * Crucial for value-add deals to see the "spread" over market cap rates.
     */
    yieldOnCost(projectedNoi, totalBasis) {
        if (!totalBasis || totalBasis <= 0) return 0;
        return ((projectedNoi / totalBasis) * 100).toFixed(2);
    },

    /**
     * Debt Service Coverage Ratio (DSCR)
     * Used by lenders to assess risk.
     */
    dscr(noi, annualDebtService) {
        if (!annualDebtService || annualDebtService <= 0) return 0;
        return (noi / annualDebtService).toFixed(2);
    },

    /**
     * Loan to Value (LTV)
     */
    ltv(loanAmount, valuation) {
        if (!valuation || valuation <= 0) return 0;
        return ((loanAmount / valuation) * 100).toFixed(1);
    },

    /**
     * Cash-on-Cash Return
     * (Annual Pre-Tax Cash Flow / Total Equity Invested)
     */
    cashOnCash(cashFlow, equity) {
        if (!equity || equity <= 0) return 0;
        return ((cashFlow / equity) * 100).toFixed(2);
    },

    /**
     * Per Unit Metrics
     */
    pricePerUnit(price, units) {
        if (!units || units <= 0) return 0;
        return Math.round(price / units);
    }
};