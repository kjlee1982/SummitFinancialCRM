/**
 * src/modules/deal-analyzer.js
 * Deal Analyzer (Underwriting) + Spreadsheet Import + Save to Deals Pipeline
 *
 * Includes:
 * - Draft mode (no selected deal) stored in sessionStorage
 * - Spreadsheet import (.xlsx/.xls/.csv) with ADPI-aware workbook scanning
 * - Run (updates selected deal OR updates draft + results)
 * - Save to Deals (creates/updates state.deals and navigates to 'deals')
 * - Waterfall (simplified pref + promote) calculator panel
 */

import { formatters } from '../utils/formatters.js';
import { stateManager } from '../state.js';
import { router } from '../router.js';

function toNumber(v, fallback = 0) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}
function toInt(v, fallback = 0) {
  const n = parseInt(v, 10);
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
function safeJsonParse(str, fallback = null) {
  try { return JSON.parse(str); } catch { return fallback; }
}

export const dealAnalyzer = {
  _bound: false,
  _activeDealId: null,

  // -----------------------
  // Selection + draft
  // -----------------------
  _getSelectedDealId() {
    try {
      const id = sessionStorage.getItem('selected_deal_id');
      return id ? String(id) : null;
    } catch (_) {
      return null;
    }
  },

  _setSelectedDealId(id) {
    try { sessionStorage.setItem('selected_deal_id', String(id)); } catch (_) {}
  },

  _draftKey() {
    return 'dealAnalyzer.draft';
  },

  _getDraft() {
    try {
      const raw = sessionStorage.getItem(this._draftKey());
      const d = safeJsonParse(raw, null);
      return d && typeof d === 'object' ? d : null;
    } catch {
      return null;
    }
  },

  _setDraft(draftObj) {
    try {
      sessionStorage.setItem(this._draftKey(), JSON.stringify(draftObj || {}));
    } catch (_) {}
  },

  _clearDraft() {
    try { sessionStorage.removeItem(this._draftKey()); } catch (_) {}
  },

  // -----------------------
  // Utils
  // -----------------------
  _escapeHtml(s) {
    return String(s ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  },

  _prefillValue(obj, keys, fallback = '') {
    for (const k of keys) {
      const v = obj?.[k];
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    return fallback;
  },

  _findDealById(state, id) {
    const deals = Array.isArray(state?.deals) ? state.deals : [];
    return deals.find(d => String(d?.id) === String(id));
  },

  _buildDealPatchFromForm(container) {
    const form = container.querySelector('#dealAnalyzerForm');
    if (!form) return null;

    return {
      // identity / pipeline
      name: String(form.querySelector('#da_name')?.value ?? '').trim(),
      address: String(form.querySelector('#da_address')?.value ?? '').trim(),
      units: toInt(form.querySelector('#da_units')?.value, 0),
      stage: String(form.querySelector('#da_stage')?.value ?? 'Sourced').trim() || 'Sourced',

      // analyzer inputs
      purchase_price: toNumber(form.querySelector('#da_purchase_price')?.value, 0),
      annual_gross_income: toNumber(form.querySelector('#da_annual_gross_income')?.value, 0),
      annual_expenses: toNumber(form.querySelector('#da_annual_expenses')?.value, 0),
      annual_debt_service: toNumber(form.querySelector('#da_annual_debt_service')?.value, 0),
      total_capex: toNumber(form.querySelector('#da_total_capex')?.value, 0),
      loan_amount: toNumber(form.querySelector('#da_loan_amount')?.value, 0),
      closing_costs: toNumber(form.querySelector('#da_closing_costs')?.value, 0)
    };
  },

  _pipelineFieldsFromDeal(deal) {
    // Ensure the deal shows in your pipeline cards even if those cards use "price/rehab".
    const metrics = this.analyze(deal);
    return {
      name: deal.name || 'Unnamed Deal',
      address: deal.address || '',
      units: Number.isFinite(deal.units) ? deal.units : toInt(deal.units, 0),
      stage: deal.stage || 'Sourced',

      // pipeline aliases
      price: toNumber(deal.purchase_price ?? deal.price, 0),
      rehab: toNumber(deal.total_capex ?? deal.rehab, 0),
      closing_costs: toNumber(deal.closing_costs ?? 0, 0),
      loan_amount: toNumber(deal.loan_amount ?? 0, 0),

      proforma_noi: metrics.noi
    };
  },

  // -----------------------
  // Spreadsheet import (ADPI-aware)
  // -----------------------
  async _importSpreadsheetFile(file) {
    const name = String(file?.name || '').toLowerCase();
    if (!file) return {};

    if (name.endsWith('.csv')) {
      const text = await file.text();
      return this._mapFromCsv(text);
    }

    // XLSX / XLS: dynamic import (SheetJS)
    const buf = await file.arrayBuffer();
    const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/xlsx.mjs');

    const wb = XLSX.read(buf, { type: 'array' });

    // ADPI workbook extraction (scans multiple tabs)
    const adpi = this._extractFromAdpiWorkbook(wb, XLSX);
    if (Object.keys(adpi).length) return adpi;

    // Fallback: generic "label/value" scan over first sheet
    const sheetName = wb.SheetNames?.[0];
    if (!sheetName) return {};
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true }) || [];
    return this._mapGenericLabelValueRows(rows);
  },

  _mapFromCsv(text) {
    const rows = String(text || '')
      .split(/\r?\n/)
      .map(line => line.split(',').map(x => String(x ?? '').trim()))
      .filter(r => r.some(c => c !== ''));

    // CSVs are usually label/value or header-based
    return this._mapGenericLabelValueRows(rows);
  },

  _normLabel(s) {
    return String(s ?? '')
      .toLowerCase()
      .replaceAll(':', '')
      .replaceAll('_', ' ')
      .replaceAll('-', ' ')
      .replace(/\s+/g, ' ')
      .trim();
  },

  _toCleanNumber(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'number') return v;

    const str = String(v).trim();
    if (!str) return null;

    // strip currency/commas/parentheses
    const cleaned = str
      .replaceAll('$', '')
      .replaceAll(',', '')
      .replace(/^\((.*)\)$/, '-$1');

    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
  },

  _findLabelRightValue(rows, wantedLabels) {
    const wanted = new Set((wantedLabels || []).map(l => this._normLabel(l)));
    for (const row of (rows || [])) {
      if (!row || row.length < 2) continue;
      const a = this._normLabel(row[0]);
      if (!wanted.has(a)) continue;

      // find the first usable value to the right
      for (let i = 1; i < row.length; i++) {
        const v = row[i];
        if (v === null || v === undefined || String(v).trim() === '') continue;
        return v;
      }
    }
    return null;
  },

  _sheetRows(wb, XLSX, sheetName) {
    const s = wb.Sheets?.[sheetName];
    if (!s) return null;
    return XLSX.utils.sheet_to_json(s, { header: 1, raw: true }) || [];
  },

  _extractFromAdpiWorkbook(wb, XLSX) {
    // Pull values from known ADPI tabs when present.
    const out = {};

    const rowsDealSummaryV2 =
      this._sheetRows(wb, XLSX, 'Deal Summary v2 (Mockup)') ||
      this._sheetRows(wb, XLSX, 'Deal Summary');

    const rowsDealSummary = this._sheetRows(wb, XLSX, 'Deal Summary');
    const rowsInputs = this._sheetRows(wb, XLSX, 'Inputs & Assumptions');
    const rowsPL = this._sheetRows(wb, XLSX, 'Profit & Loss');
    const rowsMoney = this._sheetRows(wb, XLSX, 'The Money');

    // Identity
    if (rowsDealSummaryV2) {
      const propName = this._findLabelRightValue(rowsDealSummaryV2, ['Property Name', 'Property', 'Deal Name', 'Name']);
      const location = this._findLabelRightValue(rowsDealSummaryV2, ['Location', 'Address', 'Property Address']);
      const unitCount = this._findLabelRightValue(rowsDealSummaryV2, ['Unit Count', 'Total Units', 'Units']);

      if (propName) out.name = String(propName).trim();
      if (location) out.address = String(location).trim();
      const u = this._toCleanNumber(unitCount);
      if (u !== null) out.units = u;
    }

    // Purchase price / offer
    if (rowsInputs) {
      const purchase = this._findLabelRightValue(rowsInputs, ['Purchase Price', 'Offer Price', 'Asking Price', 'Price']);
      const n = this._toCleanNumber(purchase);
      if (n !== null) out.purchase_price = n;
    }
    if (out.purchase_price == null && rowsDealSummaryV2) {
      const offer = this._findLabelRightValue(rowsDealSummaryV2, ['Offer Price', 'Purchase Price']);
      const n = this._toCleanNumber(offer);
      if (n !== null) out.purchase_price = n;
    }

    // Loan amount
    if (rowsDealSummary) {
      const loan = this._findLabelRightValue(rowsDealSummary, ['Loan Amount', 'Senior Debt', 'Debt']);
      const n = this._toCleanNumber(loan);
      if (n !== null) out.loan_amount = n;
    }
    if (out.loan_amount == null && rowsDealSummaryV2) {
      const seniorDebt = this._findLabelRightValue(rowsDealSummaryV2, ['Senior Debt', 'Loan Amount']);
      const n = this._toCleanNumber(seniorDebt);
      if (n !== null) out.loan_amount = n;
    }

    // CapEx + Closing Costs
    if (rowsMoney) {
      const reno = this._findLabelRightValue(rowsMoney, ['Renovations', 'CapEx', 'Rehab', 'Renovation Budget', 'Total CapEx']);
      const closing = this._findLabelRightValue(rowsMoney, ['Closing cost', 'Closing costs', 'Closing Cost', 'Closing Costs']);

      const r = this._toCleanNumber(reno);
      if (r !== null) out.total_capex = r;

      const c = this._toCleanNumber(closing);
      if (c !== null) out.closing_costs = c;
    }

    // Income + Expenses (Profit & Loss)
    if (rowsPL) {
      const grossOp = this._findLabelRightValue(rowsPL, [
        'Gross Operating Income',
        'Gross Potential Income (GPR)',
        'Gross Potential Income',
        'Total Income'
      ]);
      const totalOpEx = this._findLabelRightValue(rowsPL, ['Total Operating Expenses', 'Total OpEx', 'Operating Expenses']);
      const totalNonOpEx = this._findLabelRightValue(rowsPL, ['Total Non-Operating Expenses', 'Total Non OpEx', 'Non-Operating Expenses']);

      const g = this._toCleanNumber(grossOp);
      if (g !== null) out.annual_gross_income = g;

      const o = this._toCleanNumber(totalOpEx);
      const n = this._toCleanNumber(totalNonOpEx);
      const ex = (o ?? 0) + (n ?? 0);
      if (ex > 0) out.annual_expenses = ex;
    }

    // Debt Service
    if (rowsDealSummaryV2) {
      const ds = this._findLabelRightValue(rowsDealSummaryV2, ['Debt Service', 'Annual Debt Service']);
      const n = this._toCleanNumber(ds);
      if (n !== null) out.annual_debt_service = n;
    }

    // If extraction is too thin, treat as not-ADPI and let fallback run
    if (Object.keys(out).length < 3) return {};
    return out;
  },

  _mapGenericLabelValueRows(rows) {
    // Generic fallback for label/value worksheets & simple header row mapping
    const labelMap = {
      'deal name': 'name',
      'property name': 'name',
      'name': 'name',

      'address': 'address',
      'location': 'address',
      'property address': 'address',

      'unit count': 'units',
      'total units': 'units',
      'units': 'units',

      'purchase price': 'purchase_price',
      'offer price': 'purchase_price',
      'asking price': 'purchase_price',
      'price': 'purchase_price',

      'annual gross income': 'annual_gross_income',
      'gross operating income': 'annual_gross_income',
      'gross income': 'annual_gross_income',

      'annual expenses': 'annual_expenses',
      'total operating expenses': 'annual_expenses',
      'expenses': 'annual_expenses',

      'annual debt service': 'annual_debt_service',
      'debt service': 'annual_debt_service',

      'total capex': 'total_capex',
      'capex': 'total_capex',
      'rehab': 'total_capex',
      'renovations': 'total_capex',

      'loan amount': 'loan_amount',
      'senior debt': 'loan_amount',

      'closing cost': 'closing_costs',
      'closing costs': 'closing_costs'
    };

    const out = {};
    const norm = (s) => this._normLabel(s);

    // Pass 1: label/value rows
    for (const row of (rows || [])) {
      if (!row || row.length < 2) continue;
      const key = norm(row[0]);
      const mapped = labelMap[key];
      if (!mapped) continue;

      let val = null;
      for (let i = 1; i < row.length; i++) {
        const v = row[i];
        if (v === null || v === undefined || String(v).trim() === '') continue;
        val = v;
        break;
      }
      if (val === null) continue;

      const n = this._toCleanNumber(val);
      out[mapped] = (n !== null) ? n : String(val).trim();
    }

    // Pass 2: header-based (row0 headers, row1 values) if out is empty
    if (Object.keys(out).length === 0 && (rows || []).length >= 2) {
      const headers = (rows[0] || []).map(h => norm(h));
      const values = rows[1] || [];
      headers.forEach((h, idx) => {
        const mapped = labelMap[h];
        if (!mapped) return;
        const val = values[idx];
        const n = this._toCleanNumber(val);
        out[mapped] = (n !== null) ? n : (val ?? '');
      });
    }

    return out;
  },

  _applyImportedToForm(container, mapped = {}) {
    const form = container.querySelector('#dealAnalyzerForm');
    if (!form) return;

    const set = (id, v) => {
      const el = form.querySelector(`#${id}`);
      if (!el) return;
      if (v === undefined || v === null || v === '') return;
      el.value = String(v);
    };

    set('da_name', mapped.name);
    set('da_address', mapped.address);
    set('da_units', mapped.units);

    set('da_purchase_price', mapped.purchase_price);
    set('da_annual_gross_income', mapped.annual_gross_income);
    set('da_annual_expenses', mapped.annual_expenses);
    set('da_annual_debt_service', mapped.annual_debt_service);
    set('da_total_capex', mapped.total_capex);
    set('da_loan_amount', mapped.loan_amount);
    set('da_closing_costs', mapped.closing_costs);
  },

  // -----------------------
  // Bind events
  // -----------------------
  _bindOnce() {
    if (this._bound) return;
    this._bound = true;

    // Click handlers (delegated)
    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const container = document.getElementById('view-deal-analyzer');
      if (!container) return;

      const action = btn.dataset.action;

      // Run analysis
      if (action === 'deal-analyzer-run') {
        const state = stateManager.get();

        const selectedId = btn.dataset.dealId || this._activeDealId || this._getSelectedDealId();
        const deal = selectedId ? this._findDealById(state, selectedId) : null;

        const patch = this._buildDealPatchFromForm(container);
        if (!patch) return;

        if (deal) {
          // Persist analyzer fields onto the deal (non-destructive)
          const updatePatch = {
            name: patch.name || deal.name,
            address: patch.address || deal.address,
            units: patch.units ?? deal.units,
            stage: patch.stage || deal.stage,

            purchase_price: patch.purchase_price,
            annual_gross_income: patch.annual_gross_income,
            annual_expenses: patch.annual_expenses,
            annual_debt_service: patch.annual_debt_service,
            total_capex: patch.total_capex,
            loan_amount: patch.loan_amount,
            closing_costs: patch.closing_costs
          };

          await stateManager.update('deals', deal.id, updatePatch);
          this._clearDraft();
          this.render(stateManager.get());
        } else {
          // Draft mode: compute results but don't write a deal yet
          this._setDraft(patch);
          this.render(stateManager.get());
        }
        return;
      }

      // Save to Pipeline
      if (action === 'deal-analyzer-save') {
        const state = stateManager.get();
        const selectedId = btn.dataset.dealId || this._activeDealId || this._getSelectedDealId();
        const existing = selectedId ? this._findDealById(state, selectedId) : null;

        const patch = this._buildDealPatchFromForm(container);
        if (!patch) return;

        if (!patch.name) {
          alert('Please enter a Deal Name before saving.');
          return;
        }

        const merged = { ...(existing || {}), ...patch };
        const pipelineFields = this._pipelineFieldsFromDeal(merged);

        if (existing) {
          await stateManager.update('deals', existing.id, { ...pipelineFields, ...patch });
          this._clearDraft();
          this._setSelectedDealId(existing.id);
        } else {
          await stateManager.add('deals', { ...pipelineFields, ...patch });
          const newId = stateManager.get()?.deals?.[0]?.id;
          if (newId) this._setSelectedDealId(newId);
          this._clearDraft();
        }

        // Go to pipeline
        try { router.navigate('deals'); } catch (_) {}
        return;
      }

      // Spreadsheet import
      if (action === 'deal-analyzer-import') {
        const fileInput = container.querySelector('#da_spreadsheet');
        fileInput?.click();
        return;
      }
    });

    // File input change (delegated via capture to survive rerenders)
    document.addEventListener('change', async (e) => {
      const input = e.target;
      if (!input || input.id !== 'da_spreadsheet') return;

      const container = document.getElementById('view-deal-analyzer');
      if (!container) return;

      const file = input.files?.[0];
      if (!file) return;

      const status = container.querySelector('#da_import_status');
      if (status) status.textContent = `Importing: ${file.name} ...`;

      try {
        const mapped = await this._importSpreadsheetFile(file);
        this._applyImportedToForm(container, mapped);

        // Persist draft snapshot so rerender keeps values even without a selected deal
        const patch = this._buildDealPatchFromForm(container);
        if (patch) this._setDraft(patch);

        if (status) {
          const keys = Object.keys(mapped || {});
          status.textContent = keys.length
            ? `Imported ${keys.length} fields from ${file.name}.`
            : `Imported ${file.name}, but no recognizable fields were found.`;
        }
      } catch (err) {
        console.error('Spreadsheet import failed:', err);
        if (status) status.textContent = `Import failed: ${err?.message || 'Unknown error'}`;
      } finally {
        // allow re-selecting same file
        try { input.value = ''; } catch (_) {}
      }
    });
  },

  // -----------------------
  // Render
  // -----------------------
  render(state = stateManager.get()) {
    this._bindOnce();

    const container = document.getElementById('view-deal-analyzer');
    if (!container) return;

    const selectedId = this._activeDealId || this._getSelectedDealId();
    const selectedDeal = selectedId ? this._findDealById(state, selectedId) : null;

    const draft = this._getDraft();
    const working = selectedDeal || draft || {
      name: '',
      address: '',
      units: '',
      stage: 'Sourced',
      purchase_price: '',
      annual_gross_income: '',
      annual_expenses: '',
      annual_debt_service: '',
      total_capex: '',
      loan_amount: '',
      closing_costs: ''
    };

    // Prefill with analyzer keys first, then fall back to legacy keys
    const vName = this._prefillValue(working, ['name'], '');
    const vAddress = this._prefillValue(working, ['address'], '');
    const vUnits = this._prefillValue(working, ['units'], '');
    const vStage = this._prefillValue(working, ['stage'], 'Sourced');

    const vPurchase = this._prefillValue(working, ['purchase_price', 'price', 'purchasePrice'], '');
    const vIncome = this._prefillValue(working, ['annual_gross_income', 'gross_income', 'annual_income', 'grossIncome'], '');
    const vExpenses = this._prefillValue(working, ['annual_expenses', 'expenses', 'annualExpense'], '');
    const vDebt = this._prefillValue(working, ['annual_debt_service', 'debt_service', 'annualDebtService'], '');
    const vCapex = this._prefillValue(working, ['total_capex', 'rehab', 'capex', 'totalCapex'], '');
    const vLoan = this._prefillValue(working, ['loan_amount', 'loan', 'loanAmount'], '');
    const vClosing = this._prefillValue(working, ['closing_costs'], '');

    const metrics = this.analyze({
      ...working,
      purchase_price: toNumber(vPurchase, 0),
      annual_gross_income: toNumber(vIncome, 0),
      annual_expenses: toNumber(vExpenses, 0),
      annual_debt_service: toNumber(vDebt, 0),
      total_capex: toNumber(vCapex, 0),
      loan_amount: toNumber(vLoan, 0),
      closing_costs: toNumber(vClosing, 0)
    });

    const titleDealName = selectedDeal?.name
      ? this._escapeHtml(selectedDeal.name)
      : (draft?.name ? this._escapeHtml(draft.name) : 'Draft (not saved)');
    const titleDealAddress = selectedDeal?.address
      ? this._escapeHtml(selectedDeal.address)
      : (draft?.address ? this._escapeHtml(draft.address) : '');

    const isExisting = !!selectedDeal;

    container.innerHTML = `
      <div class="p-6 max-w-6xl mx-auto space-y-6">
        <div class="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <div>
            <h2 class="text-2xl font-black text-slate-900 italic tracking-tight">Deal Analyzer</h2>
            <p class="text-sm text-slate-500 font-semibold">
              ${isExisting ? 'Underwrite quickly, then save inputs back to the deal.' : 'Import or enter inputs, run analysis, then save to Deal Pipeline.'}
            </p>
          </div>
          <div class="text-right">
            <div class="text-sm font-black text-slate-900">${titleDealName}</div>
            <div class="text-xs font-semibold text-slate-500">${titleDealAddress}</div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div class="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div class="flex items-center justify-between mb-3 gap-2">
              <div class="text-sm font-black text-slate-900">Inputs</div>
              <div class="flex gap-2">
                <button data-action="deal-analyzer-import"
                  class="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-black hover:bg-slate-800">
                  <i class="fa fa-file-arrow-up mr-2"></i>Spreadsheet
                </button>
                <button data-action="deal-analyzer-run" data-deal-id="${this._escapeHtml(selectedDeal?.id || '')}"
                  class="px-3 py-2 rounded-xl bg-orange-600 text-white text-xs font-black hover:bg-orange-700">
                  <i class="fa fa-play mr-2"></i>Run
                </button>
                <button data-action="deal-analyzer-save" data-deal-id="${this._escapeHtml(selectedDeal?.id || '')}"
                  class="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-black hover:bg-emerald-700">
                  <i class="fa fa-floppy-disk mr-2"></i>${isExisting ? 'Save' : 'Save to Deals'}
                </button>
              </div>
            </div>

            <input id="da_spreadsheet" type="file" accept=".xlsx,.xls,.csv" class="hidden" />
            <div id="da_import_status" class="text-[11px] font-semibold text-slate-500 mb-3"></div>

            <form id="dealAnalyzerForm" class="space-y-3">
              ${this._inputRow('Deal name', 'da_name', vName, 'e.g. Aurora 72 Units')}
              ${this._inputRow('Address', 'da_address', vAddress, 'e.g. 123 Main St, Denver, CO')}
              ${this._inputRow('Units', 'da_units', vUnits, 'e.g. 72')}

              ${this._selectRow('Stage', 'da_stage', vStage, [
                'Sourced','Underwriting','LOI Sent','Counter Received','LOI Accepted','Awaiting DD Docs',
                'Due Diligence Started','DD LOI Modifications Needed','Offer Accepted','Closing','Closed','Asset Mgmt'
              ])}

              <div class="pt-2 border-t border-slate-100"></div>

              ${this._inputRow('Purchase price', 'da_purchase_price', vPurchase, 'e.g. 2500000')}
              ${this._inputRow('Annual gross income', 'da_annual_gross_income', vIncome, 'e.g. 420000')}
              ${this._inputRow('Annual expenses', 'da_annual_expenses', vExpenses, 'e.g. 160000')}
              ${this._inputRow('Annual debt service', 'da_annual_debt_service', vDebt, 'e.g. 210000')}
              ${this._inputRow('Total CapEx', 'da_total_capex', vCapex, 'e.g. 350000')}
              ${this._inputRow('Loan amount', 'da_loan_amount', vLoan, 'e.g. 1750000')}
              ${this._inputRow('Closing costs', 'da_closing_costs', vClosing, 'e.g. 75000')}
            </form>

            <p class="text-[11px] font-semibold text-slate-400 mt-4">
              Tip: ADPI workbooks are detected and mapped across tabs. CSV/XLSX supported.
            </p>
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
                    <td class="px-4 py-3 text-right font-black text-red-600">(${formatters.dollars(toNumber(working.annual_debt_service, 0))})</td>
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

            <div class="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
              <div class="text-sm font-black text-slate-900 mb-2">Waterfall (simplified)</div>
              <p class="text-xs font-semibold text-slate-500 mb-4">
                Pref + promote model (simple pref over hold period).
              </p>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                ${this._inputInline('Pref rate (%)', 'da_pref_rate', '8')}
                ${this._inputInline('GP promote (%)', 'da_gp_split', '20')}
                ${this._inputInline('Hold years', 'da_hold_years', '5')}
              </div>

              <div class="mt-4">
                <button id="da-waterfall-run"
                  class="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-black hover:bg-slate-800">
                  Calculate Waterfall
                </button>
              </div>

              <div id="da-waterfall-results" class="mt-4 text-sm"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Bind local-only waterfall calc button each render
    const wfBtn = container.querySelector('#da-waterfall-run');
    wfBtn?.addEventListener('click', () => {
      const pref = normalizeRate(container.querySelector('#da_pref_rate')?.value, 0.08);
      const gp = normalizeRate(container.querySelector('#da_gp_split')?.value, 0.20);
      const holdYears = normalizePositive(container.querySelector('#da_hold_years')?.value, 5);

      // Profit proxy: use net cash flow * years (you can refine later)
      const totalProfit = Math.max(0, metrics.cashFlow) * holdYears;
      const investedCapital = Math.max(0, metrics.equityRequired);

      const dist = this.calculateWaterfall(
        totalProfit,
        { pref_rate: pref, gp_split: gp, hold_years: holdYears },
        investedCapital
      );

      const out = container.querySelector('#da-waterfall-results');
      if (!out) return;

      out.innerHTML = `
        <div class="grid grid-cols-2 gap-3">
          <div class="p-3 rounded-xl border border-slate-200 bg-slate-50">
            <div class="text-[10px] font-black uppercase tracking-widest text-slate-500">LP Total</div>
            <div class="text-lg font-black text-slate-900">${formatters.dollars(dist.lpTotal)}</div>
          </div>
          <div class="p-3 rounded-xl border border-slate-200 bg-slate-50">
            <div class="text-[10px] font-black uppercase tracking-widest text-slate-500">GP Promote</div>
            <div class="text-lg font-black text-slate-900">${formatters.dollars(dist.gpTotal)}</div>
          </div>
        </div>
        <div class="mt-2 text-xs font-semibold text-slate-500">
          Pref accrued: ${formatters.dollars(dist.prefAccrual)} • Pref paid: ${formatters.dollars(dist.prefPayment)} • Remaining split: ${formatters.dollars(dist.remaining)}
        </div>
      `;
    });
  },

  _inputRow(label, id, value, placeholder = '') {
    return `
      <div>
        <label class="block text-xs font-black text-slate-600 mb-1">${this._escapeHtml(label)}</label>
        <input id="${this._escapeHtml(id)}" type="text"
          value="${this._escapeHtml(value)}" placeholder="${this._escapeHtml(placeholder)}"
          class="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all" />
      </div>
    `;
  },

  _selectRow(label, id, value, options = []) {
    const opts = (options || []).map(o => {
      const sel = String(o) === String(value) ? 'selected' : '';
      return `<option value="${this._escapeHtml(o)}" ${sel}>${this._escapeHtml(o)}</option>`;
    }).join('');

    return `
      <div>
        <label class="block text-xs font-black text-slate-600 mb-1">${this._escapeHtml(label)}</label>
        <select id="${this._escapeHtml(id)}"
          class="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all">
          ${opts}
        </select>
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

  _inputInline(label, id, value) {
    return `
      <div>
        <label class="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">${this._escapeHtml(label)}</label>
        <input id="${this._escapeHtml(id)}" type="number" step="any" value="${this._escapeHtml(value)}"
          class="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm font-semibold outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500" />
      </div>
    `;
  },

  // -----------------------
  // Analysis + waterfall
  // -----------------------
  analyze(deal) {
    const purchasePrice = toNumber(deal.purchase_price, 0);
    const grossIncome = toNumber(deal.annual_gross_income, 0);
    const expenses = toNumber(deal.annual_expenses, 0);
    const debtService = toNumber(deal.annual_debt_service, 0);
    const totalCapEx = toNumber(deal.total_capex, 0);
    const loanAmount = toNumber(deal.loan_amount, 0);

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

  calculateWaterfall(profit, terms = {}, investedCapital = 0) {
    const totalProfit = toNumber(profit, 0);
    const capital = toNumber(investedCapital, 0);

    const prefRate = normalizeRate(terms.pref_rate, 0.08);
    const gpSplit = normalizeRate(terms.gp_split, 0.20);
    const holdYears = normalizePositive(terms.hold_years, 5);

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
  }
};
