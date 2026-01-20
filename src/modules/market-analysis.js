/**
 * src/modules/market-analysis.js
 * Handles sub-market research, rent comps, and demographic trends.
 *
 * Overwrite updates included (UI kept the same):
 * - Bind-once event delegation
 * - ZIP validation (5 digits)
 * - Enter-to-analyze
 * - sessionStorage persist (last ZIP + auto-restore)
 * - Dynamic macro score (mock, varies by ZIP)
 * - Computed avg rent / avg psf from comps
 * - Correct bps spread math (x10000)
 */

import { formatters } from '../utils/formatters.js';
import { modalManager } from '../utils/modals.js';

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function cleanZip(raw) {
  const zip = String(raw ?? '').trim().replace(/\D/g, '').slice(0, 5);
  return zip;
}

function validateZip(raw) {
  const zip = cleanZip(raw);
  if (zip.length !== 5) {
    throw new Error('Enter a valid 5-digit ZIP code (e.g. 75201).');
  }
  return zip;
}

// Deterministic pseudo-random from ZIP so the mock varies but stays stable per ZIP
function zipSeed(zip) {
  let s = 0;
  for (let i = 0; i < zip.length; i++) s = (s * 31 + zip.charCodeAt(i)) % 100000;
  return s;
}

function mockMarketForZip(zip) {
  const seed = zipSeed(zip);

  // Mock metrics that look plausible and vary per ZIP
  const popGrowth5yr = clamp(3 + (seed % 80) / 10, 0.5, 10.5); // 0.5% - 10.5%
  const medianIncome = Math.round(clamp(52000 + ((seed * 7) % 60000), 45000, 125000) / 100) * 100;
  const ownerOcc = clamp(42 + ((seed * 3) % 280) / 10, 35, 75); // 35% - 75%
  const crimeBand = (seed % 3); // 0 low, 1 medium, 2 elevated

  // Build a mock macro score from metrics (still mock)
  // Score weights: income + pop growth + owner-occ - crime
  const crimePenalty = crimeBand === 0 ? 0 : crimeBand === 1 ? 8 : 16;
  const score =
    40 +
    (medianIncome - 45000) / 2500 +  // up to ~32
    popGrowth5yr * 2 +               // up to ~21
    (ownerOcc - 35) / 2 -            // up to ~20
    crimePenalty;

  const macroScore = Math.round(clamp(score, 50, 95));

  const label =
    macroScore >= 80 ? 'Strong Growth' :
    macroScore >= 65 ? 'Stable' :
    'Caution';

  const crimeLabel =
    crimeBand === 0 ? 'Low' :
    crimeBand === 1 ? 'Moderate' :
    'Elevated';

  return {
    zip,
    popGrowth5yr,
    medianIncome,
    ownerOcc,
    crimeLabel,
    macroScore,
    macroLabel: label
  };
}

function getMockComps(zip = '') {
  // Keep the same comps shape/UI, but lightly vary rents by ZIP so the header averages feel "computed"
  const seed = zip ? zipSeed(zip) : 12345;
  const bump = ((seed % 9) - 4) * 25; // -100 .. +100

  return [
    { name: 'The Highline Apartments', class: 'A',  rent: 2150 + bump, psf: 2.45, occ: 96, dist: '0.4 mi' },
    { name: 'Oak Creek Village',      class: 'B',  rent: 1650 + bump, psf: 1.85, occ: 94, dist: '1.2 mi' },
    { name: 'Midtown Lofts',          class: 'A-', rent: 1980 + bump, psf: 2.20, occ: 92, dist: '0.8 mi' }
  ];
}

function avg(list, key) {
  if (!Array.isArray(list) || list.length === 0) return 0;
  const sum = list.reduce((a, x) => a + (Number(x?.[key]) || 0), 0);
  return sum / list.length;
}

export const marketAnalysis = {
  _bound: false,
  _lastZip: '',

  /**
   * Renders the Market Analysis View
   */
  render(state) {
    const container = document.getElementById('view-market-analysis');
    if (!container) return;

    // restore last zip
    let lastZip = '';
    try {
      lastZip = sessionStorage.getItem('market_zip_last') || '';
    } catch (_) {}
    this._lastZip = cleanZip(lastZip);

    const comps = getMockComps(this._lastZip);
    const avgRent = Math.round(avg(comps, 'rent'));
    const avgPsf = avg(comps, 'psf');

    // macro defaults (if we have a last zip, compute; else keep original 84 look)
    const macro = this._lastZip ? mockMarketForZip(this._lastZip) : { macroScore: 84, macroLabel: 'Strong Growth' };

    container.innerHTML = `
      <div class="p-6 max-w-7xl mx-auto space-y-6">
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 class="text-2xl font-black text-slate-900 italic tracking-tight">Market Intelligence</h2>
            <p class="text-sm text-slate-500 font-medium tracking-tight">Real-time demographic shifts and asset-class comparables.</p>
          </div>
          <div class="flex gap-2 w-full md:w-auto">
            <div class="relative flex-grow">
              <i class="fa fa-map-pin absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              <input type="text" id="market-zip-search" placeholder="Enter Zip Code (e.g. 75201)..."
                value="${escapeHtml(this._lastZip)}"
                class="w-full md:w-64 pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all">
            </div>
            <button id="analyze-market-btn" class="bg-slate-900 text-white px-6 py-2.5 rounded-xl hover:bg-slate-800 font-bold text-sm transition-all shadow-lg shadow-slate-200">
              Analyze
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">

          <div class="lg:col-span-1 space-y-6">
            <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 class="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Macro Health Score</h3>
              <div class="flex items-center justify-between mb-2">
                <span class="text-3xl font-black text-slate-900">${escapeHtml(macro.macroScore)}<span class="text-slate-300 text-lg">/100</span></span>
                <span class="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded uppercase">${escapeHtml(macro.macroLabel)}</span>
              </div>
              <div class="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div class="bg-orange-500 h-full" style="width:${clamp(macro.macroScore, 0, 100)}%"></div>
              </div>

              <div id="market-demo-results" class="mt-8 space-y-5">
                <div class="text-center py-6 border-2 border-dashed border-slate-100 rounded-xl">
                  <p class="text-xs text-slate-400 font-medium italic px-4">Enter a zip code to pull Census & Bureau of Labor Statistics data.</p>
                </div>
              </div>
            </div>

            <div class="bg-slate-900 p-6 rounded-2xl text-white shadow-xl">
              <p class="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-1">Market Risk Premium</p>
              <h4 class="text-sm font-bold mb-4">Current Alpha Spread</h4>
              <div class="space-y-3">
                <div class="flex justify-between text-xs font-medium">
                  <span class="text-slate-400">Market Avg Cap:</span>
                  <span>5.25%</span>
                </div>
                <div class="flex justify-between text-xs font-medium">
                  <span class="text-slate-400">Risk-Free Rate:</span>
                  <span>4.10%</span>
                </div>
                <div class="pt-2 border-t border-slate-800 flex justify-between font-black text-orange-400">
                  <span>Market Spread:</span>
                  <span>115 bps</span>
                </div>
              </div>
            </div>
          </div>

          <div class="lg:col-span-3 space-y-6">
            <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div class="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                <h3 class="text-xs font-black text-slate-900 uppercase tracking-widest">Rent Comparables (3-Mile Radius)</h3>
                <div class="flex gap-4">
                  <span class="text-[10px] font-bold text-slate-500 uppercase">Avg Rent: <b class="text-slate-900">${formatters.dollars(avgRent)}</b></span>
                  <span class="text-[10px] font-bold text-slate-500 uppercase">Avg PSF: <b class="text-orange-600">$${avgPsf.toFixed(2)}</b></span>
                </div>
              </div>
              <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-slate-100">
                  <thead class="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <tr>
                      <th class="px-6 py-4 text-left">Comp Property</th>
                      <th class="px-6 py-4 text-left">Asset Class</th>
                      <th class="px-6 py-4 text-left">Avg Rent</th>
                      <th class="px-6 py-4 text-left">Rent/SF</th>
                      <th class="px-6 py-4 text-left">Occupancy</th>
                      <th class="px-6 py-4 text-right">Distance</th>
                    </tr>
                  </thead>
                  <tbody id="market-comps-tbody" class="divide-y divide-slate-50 text-sm">
                    ${this.renderComps(comps)}
                  </tbody>
                </table>
              </div>
            </div>


          </div>
        </div>
      </div>
    `;

    this.bindEvents();

    // Auto-render if last zip exists (persisted)
    if (this._lastZip) {
      this.analyzeZip(this._lastZip, { persist: false });
    }
  },

  bindEvents() {
    const container = document.getElementById('view-market-analysis');
    if (!container) return;

    if (this._bound) return;
    this._bound = true;

    // Click delegation
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('#analyze-market-btn');
      if (!btn) return;
      this.analyzeFromInput();
    });

    // Enter-to-analyze (only for the search box)
    container.addEventListener('keydown', (e) => {
      const isZipBox = e.target && e.target.id === 'market-zip-search';
      if (!isZipBox) return;

      if (e.key === 'Enter') {
        e.preventDefault();
        this.analyzeFromInput();
      }
    });
  },

  analyzeFromInput() {
    const input = document.getElementById('market-zip-search');
    if (!input) return;

    try {
      const zip = validateZip(input.value);

      // normalize display
      input.value = zip;

      // persist last zip
      try {
        sessionStorage.setItem('market_zip_last', zip);
      } catch (_) {}

      this._lastZip = zip;
      this.analyzeZip(zip, { persist: true });
    } catch (err) {
      modalManager.show(
        'Invalid ZIP',
        `<p class="text-sm font-semibold text-slate-700">${escapeHtml(err?.message || 'Please enter a valid ZIP code.')}</p>`,
        () => true,
        { submitLabel: 'OK', hideCancel: true }
      );
    }
  },

  analyzeZip(zip, { persist = false } = {}) {
    // Update comps (optionally vary by zip)
    const comps = getMockComps(zip);
    const tbody = document.getElementById('market-comps-tbody');
    if (tbody) tbody.innerHTML = this.renderComps(comps);

    // Update the demo metrics + insight
    const mock = mockMarketForZip(zip);
    this.updateMarketDisplay(mock);

    // Update Macro score UI (same look, different value/width/text)
    // (We keep the exact structure; just patch the existing nodes.)
    const container = document.getElementById('view-market-analysis');
    if (!container) return;

    // Find the score line: the big "84/100" span is first in that block.
    // We re-render the whole view in a UI-identical way would be heavier; we patch minimal.
    // To keep it robust, we simply re-render the view with the current zip (still identical UI).
    if (persist) {
      // re-render so header averages + macro score reflect this ZIP too
      this._bound = true; // keep listeners attached
      this.render({});
    }
  },

  /**
   * Updates the UI with "fetched" data (mock)
   */
  updateMarketDisplay(zipData) {
    const demoContainer = document.getElementById('market-demo-results');
    if (!demoContainer) return;

    demoContainer.innerHTML = `
      <div class="space-y-4">
        <div class="flex justify-between items-end border-b border-slate-50 pb-2">
          <span class="text-[10px] font-black text-slate-400 uppercase">Pop. Growth (5yr)</span>
          <span class="text-sm font-black text-emerald-600">+${zipData.popGrowth5yr.toFixed(1)}%</span>
        </div>
        <div class="flex justify-between items-end border-b border-slate-50 pb-2">
          <span class="text-[10px] font-black text-slate-400 uppercase">Median HH Income</span>
          <span class="text-sm font-black text-slate-900">${formatters.dollars(zipData.medianIncome)}</span>
        </div>
        <div class="flex justify-between items-end border-b border-slate-50 pb-2">
          <span class="text-[10px] font-black text-slate-400 uppercase">Owner Occupied</span>
          <span class="text-sm font-black text-slate-900">${zipData.ownerOcc.toFixed(1)}%</span>
        </div>
        <div class="flex justify-between items-end border-b border-slate-50 pb-2">
          <span class="text-[10px] font-black text-slate-400 uppercase">Crime Index</span>
          <span class="text-sm font-black text-blue-600">${escapeHtml(zipData.crimeLabel)}</span>
        </div>
      </div>
      <div class="mt-6 p-4 bg-orange-50 rounded-xl border border-orange-100">
        <p class="text-[11px] text-orange-800 leading-relaxed font-medium">
          <i class="fa fa-lightbulb mr-1"></i> <b>Market Insight:</b> Higher than average income growth detected in ${escapeHtml(zipData.zip || 'this area')}. Recommend Class-B value-add strategies.
        </p>
      </div>
    `;
  },

  renderComps(comps) {
    return (comps || []).map(comp => `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="px-6 py-4 font-bold text-slate-900">${escapeHtml(comp.name)}</td>
        <td class="px-6 py-4"><span class="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-black">CLASS ${escapeHtml(comp.class)}</span></td>
        <td class="px-6 py-4 font-semibold text-slate-700">${formatters.dollars(comp.rent)}</td>
        <td class="px-6 py-4 font-medium text-slate-500">$${Number(comp.psf).toFixed(2)}</td>
        <td class="px-6 py-4">
          <div class="flex items-center gap-2">
            <div class="w-12 bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div class="bg-emerald-500 h-full" style="width: ${clamp(comp.occ, 0, 100)}%"></div>
            </div>
            <span class="text-[10px] font-bold">${escapeHtml(comp.occ)}%</span>
          </div>
        </td>
        <td class="px-6 py-4 text-right text-xs font-bold text-slate-400">${escapeHtml(comp.dist)}</td>
      </tr>
    `).join('');
  },

  /**
   * Logic to calculate "Spread" between Market Cap Rates and Deal Cap Rates (bps)
   * If dealCap/marketCap are decimals (0.06, 0.0525):
   * bps = (dealCap - marketCap) * 10,000
   */
  calculateMarketSpread(dealCap, marketCap) {
    const d = Number(dealCap);
    const m = Number(marketCap);
    if (!Number.isFinite(d) || !Number.isFinite(m)) return '0 bps';
    const spreadBps = (d - m) * 10000;
    return `${spreadBps.toFixed(0)} bps`;
  }
};
