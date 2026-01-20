/**
 * src/modules/deal-analyzer.js
 * Deal Analyzer view + spreadsheet import (ADPI Basic Analyzer w Deal Summary).
 *
 * Behavior:
 * - Upload spreadsheet -> populate analyzer inputs (NO auto-save)
 * - Run Analysis -> calculates core metrics in this view
 * - Save to Deals -> saves to Deals pipeline when you choose
 */

import { stateManager } from '../state.js';
import { router } from '../router.js';
import { modalManager } from '../utils/modals.js';
import { formatters } from '../utils/formatters.js';

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function toNumber(v, fallback = 0) {
  const n = parseFloat(String(v ?? '').replaceAll(',', ''));
  return Number.isFinite(n) ? n : fallback;
}

function toInt(v, fallback = 0) {
  const n = parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeRate(v, fallback = 0) {
  let r = toNumber(v, fallback);
  if (r > 1) r = r / 100;
  return r;
}

function getXLSX() {
  return window.XLSX;
}

function readCell(ws, addr) {
  try {
    const cell = ws?.[addr];
    if (!cell) return null;
    return cell.v ?? cell.w ?? null;
  } catch {
    return null;
  }
}

function firstNonEmpty(...vals) {
  for (const v of vals) {
    if (v === 0) return v;
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (s) return v;
  }
  return null;
}

function findSheet(wb, ...names) {
  const list = wb?.SheetNames || [];
  for (const n of names) {
    if (list.includes(n)) return wb.Sheets[n];
  }
  for (const n of names) {
    const hit = list.find(x => String(x).toLowerCase() === String(n).toLowerCase());
    if (hit) return wb.Sheets[hit];
  }
  return null;
}

function searchLabel(ws, labelText, { rowLimit = 140, colLimit = 26, offsetCols = 1 } = {}) {
  const XLSX = getXLSX();
  if (!XLSX || !ws?.['!ref']) return null;

  const label = String(labelText ?? '').trim().toLowerCase();
  if (!label) return null;

  const range = XLSX.utils.decode_range(ws['!ref']);
  const rMax = Math.min(range.e.r, rowLimit - 1);
  const cMax = Math.min(range.e.c, colLimit - 1);

  for (let r = range.s.r; r <= rMax; r++) {
    for (let c = range.s.c; c <= cMax; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const v = readCell(ws, addr);
      if (!v) continue;
      const txt = String(v).trim().toLowerCase();
      if (txt === label || txt.includes(label)) {
        const target = XLSX.utils.encode_cell({ r, c: c + offsetCols });
        return readCell(ws, target);
      }
    }
  }
  return null;
}

function money(n) {
  return formatters?.dollars ? formatters.dollars(toNumber(n, 0)) : `$${toNumber(n, 0).toLocaleString()}`;
}

export const dealAnalyzer = {
  _bound: false,
  _lastState: null,

  // Draft values currently shown in the analyzer (from import or manual edits)
  _draft: {
    name: '',
    address: '',
    units: 0,
    purchase_price: 0,
    annual_gross_income: 0,
    annual_expenses: 0,
    annual_debt_service: 0,
    total_capex: 0,
    loan_amount: 0
  },

  _analysis: null,
  _lastSavedDealId: null,

  render(state) {
    const container = document.getElementById('view-deal-analyzer');
    if (!container) return;

    this._lastState = state;

    const d = this._draft || {};
    const a = this._analysis;

    container.innerHTML = `
      <div class="p-6 max-w-5xl mx-auto">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 class="text-2xl font-black text-slate-900 tracking-tight">Deal Analyzer</h2>
            <p class="text-sm text-slate-500 font-medium">
              Upload your ADPI spreadsheet to populate inputs, then run analysis. Use <span class="font-black">Save to Deals</span> when ready.
            </p>
          </div>

          <div class="flex flex-wrap gap-2">
            <button data-action="da-upload" class="bg-slate-900 text-white px-4 py-2.5 rounded-xl hover:bg-slate-800 font-bold shadow-sm transition-all text-sm">
              <i class="fa fa-file-arrow-up mr-2"></i>Upload Spreadsheet
            </button>
            <button data-action="da-run" class="bg-white border border-slate-200 text-slate-900 px-4 py-2.5 rounded-xl hover:bg-slate-50 font-bold shadow-sm transition-all text-sm">
              <i class="fa fa-bolt mr-2"></i>Run Analysis
            </button>
            <button data-action="da-save" class="bg-orange-600 text-white px-4 py-2.5 rounded-xl hover:bg-orange-700 font-bold shadow-sm transition-all text-sm">
              <i class="fa fa-floppy-disk mr-2"></i>Save to Deals
            </button>
            <button data-action="da-go-deals" class="bg-white border border-slate-200 text-slate-800 px-4 py-2.5 rounded-xl hover:bg-slate-50 font-bold shadow-sm transition-all text-sm">
              <i class="fa fa-briefcase mr-2"></i>Go to Deals
            </button>
          </div>
        </div>

        <input id="da-xlsx" type="file" accept=".xlsx,.xls" class="hidden" />

        <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div class="lg:col-span-3 bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
            <div class="flex items-center justify-between gap-4 mb-4">
              <div>
                <div class="text-[10px] font-black uppercase tracking-widest text-slate-400">Inputs</div>
                <div class="text-sm font-semibold text-slate-600">Edit anything after import.</div>
              </div>
              ${this._lastSavedDealId ? `
                <button data-action="da-open-saved" class="text-sm font-black text-orange-600 hover:text-orange-700">
                  Open saved deal <i class="fa fa-arrow-right ml-1"></i>
                </button>
              ` : ''}
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="md:col-span-2">
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Deal / Property Name</label>
                <input id="da-name" type="text" value="${escapeHtml(d.name || '')}" placeholder="e.g. Aspen Ridge Apartments"
                  class="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
              </div>

              <div class="md:col-span-2">
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Address</label>
                <input id="da-address" type="text" value="${escapeHtml(d.address || '')}" placeholder="123 Main St, City, ST"
                  class="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
              </div>

              <div>
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Units</label>
                <input id="da-units" type="number" inputmode="numeric" value="${toInt(d.units, 0)}"
                  class="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
              </div>

              <div>
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Purchase Price</label>
                <input id="da-purchase_price" type="number" inputmode="decimal" value="${toNumber(d.purchase_price, 0)}"
                  class="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
              </div>

              <div>
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Annual Gross Income (Yr 1)</label>
                <input id="da-annual_gross_income" type="number" inputmode="decimal" value="${toNumber(d.annual_gross_income, 0)}"
                  class="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
              </div>

              <div>
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Annual Operating Expenses (Yr 1)</label>
                <input id="da-annual_expenses" type="number" inputmode="decimal" value="${toNumber(d.annual_expenses, 0)}"
                  class="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
              </div>

              <div>
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Annual Debt Service (Yr 1)</label>
                <input id="da-annual_debt_service" type="number" inputmode="decimal" value="${toNumber(d.annual_debt_service, 0)}"
                  class="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
              </div>

              <div>
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total CapEx (Rehab + WC)</label>
                <input id="da-total_capex" type="number" inputmode="decimal" value="${toNumber(d.total_capex, 0)}"
                  class="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
              </div>

              <div>
                <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Loan Amount</label>
                <input id="da-loan_amount" type="number" inputmode="decimal" value="${toNumber(d.loan_amount, 0)}"
                  class="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
              </div>
            </div>

            <div class="mt-4 text-[11px] font-semibold text-slate-400">
              Tip: Import maps the fields it can find; anything missing can be typed in before running analysis.
            </div>
          </div>

          <div class="lg:col-span-2 space-y-6">
            <div class="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
              <div class="text-[10px] font-black uppercase tracking-widest text-slate-400">Results</div>
              ${a ? `
                <div class="grid grid-cols-2 gap-3 mt-4">
                  <div class="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div class="text-[10px] font-black uppercase tracking-widest text-slate-400">NOI</div>
                    <div class="text-sm font-black text-slate-900 mt-1">${money(a.noi)}</div>
                  </div>
                  <div class="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div class="text-[10px] font-black uppercase tracking-widest text-slate-400">Cap Rate</div>
                    <div class="text-sm font-black text-slate-900 mt-1">${formatters.percent(a.capRate)}</div>
                  </div>
                  <div class="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div class="text-[10px] font-black uppercase tracking-widest text-slate-400">Cash Flow</div>
                    <div class="text-sm font-black text-slate-900 mt-1">${money(a.cashFlow)}</div>
                  </div>
                  <div class="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div class="text-[10px] font-black uppercase tracking-widest text-slate-400">Cash-on-Cash</div>
                    <div class="text-sm font-black text-slate-900 mt-1">${formatters.percent(a.cashOnCash)}</div>
                  </div>
                  <div class="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div class="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Basis</div>
                    <div class="text-sm font-black text-slate-900 mt-1">${money(a.totalBasis)}</div>
                  </div>
                  <div class="bg-slate-50 rounded-xl p-3 border border-slate-100">
                    <div class="text-[10px] font-black uppercase tracking-widest text-slate-400">DSCR</div>
                    <div class="text-sm font-black text-slate-900 mt-1">${(a.debtServiceCoverage || 0).toFixed(2)}x</div>
                  </div>
                </div>

                <div class="mt-4 text-[11px] font-semibold text-slate-500">
                  Equity Required: <span class="font-black text-slate-900">${money(a.equityRequired)}</span>
                </div>
              ` : `
                <div class="mt-3 text-sm font-semibold text-slate-500">
                  No analysis yet. Click <span class="font-black">Run Analysis</span>.
                </div>
              `}
            </div>

            <div class="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
              <div class="text-[10px] font-black uppercase tracking-widest text-slate-400">Import status</div>
              <div class="mt-2 text-sm font-semibold text-slate-600">
                ${d._importedFrom ? `Loaded from: <span class="font-black">${escapeHtml(d._importedFrom)}</span>` : 'No spreadsheet imported yet.'}
              </div>
              <div class="mt-3 text-[11px] font-semibold text-slate-400">
                If Upload does nothing, confirm the XLSX script is loading and you selected a .xlsx file.
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  },

  bindEvents() {
    const container = document.getElementById('view-deal-analyzer');
    if (!container) return;

    const input = document.getElementById('da-xlsx');
    if (input) {
      input.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        // allow selecting same file twice
        e.target.value = '';
        await this.importSpreadsheet(file);
      };
    }

    if (this._bound) return;
    this._bound = true;

    container.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;

      if (action === 'da-upload') {
        document.getElementById('da-xlsx')?.click();
        return;
      }

      if (action === 'da-run') {
        this.runAnalysisFromDom();
        return;
      }

      if (action === 'da-save') {
        await this.saveToDealsFromDom();
        return;
      }

      if (action === 'da-go-deals') {
        router.navigate('deals');
        return;
      }

      if (action === 'da-open-saved') {
        if (this._lastSavedDealId) sessionStorage.setItem('selected_deal_id', String(this._lastSavedDealId));
        router.navigate('deals');
      }
    });
  },

  getDraftFromDom() {
    const val = (id) => document.getElementById(id)?.value;
    const d = {
      ...this._draft,
      name: String(val('da-name') ?? '').trim(),
      address: String(val('da-address') ?? '').trim(),
      units: toInt(val('da-units'), 0),
      purchase_price: toNumber(val('da-purchase_price'), 0),
      annual_gross_income: toNumber(val('da-annual_gross_income'), 0),
      annual_expenses: toNumber(val('da-annual_expenses'), 0),
      annual_debt_service: toNumber(val('da-annual_debt_service'), 0),
      total_capex: toNumber(val('da-total_capex'), 0),
      loan_amount: toNumber(val('da-loan_amount'), 0)
    };
    this._draft = d;
    return d;
  },

  runAnalysisFromDom() {
    const d = this.getDraftFromDom();
    this._analysis = this.analyze(d);
    // Re-render to update results card (no state change trigger)
    this.render(this._lastState || stateManager.get());
  },

  async saveToDealsFromDom() {
    const d = this.getDraftFromDom();

    if (!d.name) {
      modalManager.alert({ title: 'Missing info', message: 'Please enter a Deal / Property Name before saving.' });
      return;
    }

    // Recommended: run analysis first so equity required etc is computed
    if (!this._analysis) {
      this._analysis = this.analyze(d);
    }

    const dealToSave = this.buildPipelineDeal(d, this._analysis);

    await stateManager.add('deals', dealToSave);

    const newDeal = (stateManager.get()?.deals || [])[0] || null;
    if (newDeal?.id) {
      this._lastSavedDealId = newDeal.id;
      sessionStorage.setItem('selected_deal_id', String(newDeal.id));
    }

    modalManager.alert({
      title: 'Saved to Deals',
      message: `Added “${d.name}” to Deals (stage: ${dealToSave.stage}).`
    });

    // Stay in Deal Analyzer (your request)
    this.render(this._lastState || stateManager.get());
  },

  async importSpreadsheet(file) {
    const XLSX = getXLSX();
    if (!XLSX) {
      modalManager.alert({
        title: 'Spreadsheet import not available',
        message: 'The XLSX library did not load. Ensure the XLSX script is included in index.html.'
      });
      return;
    }

    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });

      const extracted = this.extractFromWorkbook(wb);
      if (!extracted?.name && !extracted?.purchase_price) {
        modalManager.alert({
          title: 'Import failed',
          message: 'Could not locate expected fields. Make sure you are using your “ADPI Basic Analyzer w Deal Summary” workbook.'
        });
        return;
      }

      this._draft = {
        ...this._draft,
        ...extracted,
        _importedFrom: file?.name || 'Spreadsheet'
      };

      // Clear old results; user will run analysis
      this._analysis = null;

      modalManager.alert({
        title: 'Spreadsheet loaded',
        message: 'Inputs were populated. Review/adjust fields and click Run Analysis.'
      });

      this.render(this._lastState || stateManager.get());
    } catch (err) {
      console.error('Spreadsheet import failed', err);
      modalManager.alert({
        title: 'Import failed',
        message: 'There was an error reading that file. Try re-exporting the XLSX or using the original workbook.'
      });
    }
  },

  extractFromWorkbook(wb) {
    // Sheets from your template
    const wsInputs = findSheet(wb, 'Inputs & Assumptions', 'Inputs and Assumptions');
    const wsSummary = findSheet(wb, 'Deal Summary', 'Deal Summary v2 (Mockup)');
    const wsMoney = findSheet(wb, 'The Money', 'TheMoney');
    const wsPL = findSheet(wb, 'Profit & Loss', 'Profit and Loss');

    // Name / Address
    const name = firstNonEmpty(
      readCell(wsInputs, 'C11'),
      readCell(wsSummary, 'C10'),
      searchLabel(wsInputs, 'Property Name'),
      searchLabel(wsSummary, 'Property Name')
    );

    const address = firstNonEmpty(
      readCell(wsInputs, 'C12'),
      searchLabel(wsInputs, 'Address'),
      readCell(wsSummary, 'C4')
    );

    // Units
    const units = toInt(firstNonEmpty(
      readCell(wsSummary, 'C11'),
      readCell(wsInputs, 'C30'),
      searchLabel(wsSummary, 'Number of Units'),
      searchLabel(wsInputs, 'Total Units')
    ), 0);

    // Purchase / Offer price
    const purchase_price = toNumber(firstNonEmpty(
      readCell(wsSummary, 'C14'),
      readCell(wsInputs, 'C19'),
      searchLabel(wsSummary, 'Offer Price'),
      searchLabel(wsSummary, '(Your) Offer Price'),
      searchLabel(wsInputs, 'Purchase Price')
    ), 0);

    // Income / Expenses / Debt service (Year 1)
    const annual_gross_income = toNumber(firstNonEmpty(
      readCell(wsPL, 'D18'),
      searchLabel(wsPL, 'Gross Operating Income'),
      searchLabel(wsPL, 'Gross Operating Income Year 1'),
      searchLabel(wsSummary, 'Gross Operating Income')
    ), 0);

    const annual_expenses = toNumber(firstNonEmpty(
      readCell(wsPL, 'D45'),
      searchLabel(wsPL, 'Total Operating Expenses'),
      searchLabel(wsPL, 'Operating Expenses')
    ), 0);

    const annual_debt_service = toNumber(firstNonEmpty(
      readCell(wsPL, 'D56'),
      searchLabel(wsPL, 'Debt Service'),
      searchLabel(wsPL, 'Annual Debt Service')
    ), 0);

    // CapEx (Renovations + Working Capital)
    const renovations = toNumber(firstNonEmpty(
      readCell(wsMoney, 'C27'),
      searchLabel(wsMoney, 'Renovations')
    ), 0);

    const workingCap = toNumber(firstNonEmpty(
      readCell(wsMoney, 'C28'),
      searchLabel(wsMoney, 'Working Capital'),
      searchLabel(wsMoney, 'Working cap')
    ), 0);

    const total_capex = renovations + workingCap;

    // Loan amount
    const loan_amount = toNumber(firstNonEmpty(
      readCell(wsMoney, 'C12'),
      readCell(wsSummary, 'F10'),
      searchLabel(wsMoney, 'Amount Financed'),
      searchLabel(wsSummary, 'Loan Amount')
    ), 0);

    return {
      name: String(name ?? '').trim(),
      address: String(address ?? '').trim(),
      units,
      purchase_price,
      annual_gross_income,
      annual_expenses,
      annual_debt_service,
      total_capex,
      loan_amount
    };
  },

  buildPipelineDeal(draft, analysis) {
    const name = String(draft?.name || 'Imported Deal').trim();
    const address = String(draft?.address || '').trim();
    const units = toInt(draft?.units, 0);

    const purchase = toNumber(draft?.purchase_price, 0);
    const capex = toNumber(draft?.total_capex, 0);

    // Deals pipeline fields
    const price = purchase;
    const rehab = capex;
    const proforma_noi = toNumber(analysis?.noi, 0);

    return {
      name,
      address,
      units,
      price,
      rehab,
      closing_costs: 0,
      proforma_noi,

      // Preserve analyzer fields so analysis can be reproduced later
      purchase_price: purchase,
      annual_gross_income: toNumber(draft?.annual_gross_income, 0),
      annual_expenses: toNumber(draft?.annual_expenses, 0),
      annual_debt_service: toNumber(draft?.annual_debt_service, 0),
      total_capex: capex,
      loan_amount: toNumber(draft?.loan_amount, 0),

      stage: 'Underwriting'
    };
  },

  /**
   * Calculates the core metrics for a deal/draft.
   * Accepts either analyzer-style keys or pipeline-style keys.
   */
  analyze(deal) {
    const purchasePrice = firstNonEmpty(deal?.purchase_price, deal?.price);
    const purchase = toNumber(purchasePrice, 0);

    const grossIncome = toNumber(deal?.annual_gross_income, 0);
    const expenses = toNumber(deal?.annual_expenses, 0);
    const debtService = toNumber(deal?.annual_debt_service, 0);

    const totalCapEx = toNumber(firstNonEmpty(deal?.total_capex, deal?.rehab), 0);
    const loanAmount = toNumber(deal?.loan_amount, 0);

    const noi = grossIncome - expenses;
    const cashFlow = noi - debtService;
    const totalBasis = purchase + totalCapEx;
    const equityRequired = totalBasis - loanAmount;

    return {
      noi,
      cashFlow,
      totalBasis,
      equityRequired,
      capRate: purchase > 0 ? (noi / purchase) : 0,
      cashOnCash: equityRequired > 0 ? (cashFlow / equityRequired) : 0,
      yieldOnCost: totalBasis > 0 ? (noi / totalBasis) : 0,
      ltc: totalBasis > 0 ? (loanAmount / totalBasis) : 0,
      debtServiceCoverage: debtService > 0 ? (noi / debtService) : 0
    };
  },

  /**
   * Waterfall Distribution Logic (Standard Pref + Promote)
   */
  calculateWaterfall(profit, terms = {}, investedCapital = 0) {
    const totalProfit = toNumber(profit, 0);
    const capital = toNumber(investedCapital, 0);

    const prefRate = normalizeRate(terms.pref_rate, 0.08);
    const gpSplit = normalizeRate(terms.gp_split, 0.20);
    const holdYears = toNumber(terms.hold_years, 5) > 0 ? toNumber(terms.hold_years, 5) : 5;

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
   * Renders the Analysis Card in the Deal View (if you wire it in)
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
        </div>
      `;
    }
  }
};
