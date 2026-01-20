/**
 * src/modules/analytics.js
 * Portfolio analytics + charts + filter row (with debounced inputs).
 */
import { stateManager } from '../state.js';
import { formatters } from '../utils/formatters.js';

function num(v) {
  const n = typeof v === 'string' ? Number(v.replace(/,/g, '').trim()) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function debounce(fn, wait = 250) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

export const analytics = {
  _charts: {
    exposure: null,
    capitalStack: null
  },

  _filters: {
    q: '',
    owning_llc: 'all',
    min_occ: 0,
    min_cap: 0, // %
    min_noi: 0  // $
  },

  _bound: false,

  // Will be created on first bind
  _debouncedApply: null,

  render() {
    const container = document.getElementById('view-analytics');
    if (!container) return;

    const state = stateManager.get();
    const allProps = Array.isArray(state?.properties) ? state.properties : [];

    const llcOptions = Array.from(
      new Set(allProps.map(p => (p.owning_llc || '').toString().trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));

    const filtered = this.applyFilters(allProps, this._filters);
    const metrics = this.calculateMetrics(filtered);

    container.innerHTML = `
      <div class="p-8 space-y-8">
        <div>
          <h2 class="text-2xl font-black text-slate-900 tracking-tight">Financial Analytics</h2>
          <p class="text-sm text-gray-500 font-medium">Deep dive into portfolio yield, debt-to-equity, and exposure.</p>
        </div>

        <!-- FILTER ROW -->
        <div class="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
          <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div class="md:col-span-4">
              <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Search Property</label>
              <input id="an-q" type="text"
                value="${this.escapeAttr(this._filters.q)}"
                placeholder="Type a property name..."
                class="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
              <p class="mt-1 text-[10px] text-slate-400 font-bold">Debounced</p>
            </div>

            <div class="md:col-span-3">
              <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Owning LLC</label>
              <select id="an-llc"
                class="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              >
                <option value="all"${this._filters.owning_llc === 'all' ? ' selected' : ''}>All</option>
                ${llcOptions.map(llc => `
                  <option value="${this.escapeAttr(llc)}"${this._filters.owning_llc === llc ? ' selected' : ''}>${this.escapeHtml(llc)}</option>
                `).join('')}
              </select>
            </div>

            <div class="md:col-span-2">
              <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Min Occupancy</label>
              <div class="flex items-center gap-2">
                <input id="an-occ" type="number" min="0" max="100"
                  value="${this._filters.min_occ}"
                  class="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
                <span class="text-sm font-black text-slate-400">%</span>
              </div>
            </div>

            <div class="md:col-span-1">
              <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Min Cap</label>
              <div class="flex items-center gap-2">
                <input id="an-cap" type="number" min="0" max="100" step="0.1"
                  value="${this._filters.min_cap}"
                  class="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                />
                <span class="text-sm font-black text-slate-400">%</span>
              </div>
            </div>

            <div class="md:col-span-1">
              <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Min NOI</label>
              <input id="an-noi" type="number" min="0" step="1000"
                value="${this._filters.min_noi}"
                class="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              />
            </div>

            <div class="md:col-span-1 flex md:justify-end">
              <button id="an-reset"
                class="w-full md:w-auto px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-black hover:bg-slate-800 transition-all"
                title="Reset filters"
              >
                Reset
              </button>
            </div>

            <div class="md:col-span-12">
              <p class="text-[11px] font-semibold text-slate-500">
                Showing <span class="font-black text-slate-900">${filtered.length}</span> of <span class="font-black text-slate-900">${allProps.length}</span> properties
              </p>
            </div>
          </div>
        </div>

        <!-- KPI CARDS -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Portfolio Cap Rate (Avg)</p>
            <p class="text-2xl font-black text-slate-900">${metrics.avgCapRate.toFixed(2)}%</p>
          </div>
          <div class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Valuation</p>
            <p class="text-2xl font-black text-blue-600">${formatters.compact(metrics.totalValuation)}</p>
          </div>
          <div class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
            <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Debt to Equity</p>
            <p class="text-2xl font-black text-emerald-600">${metrics.debtToEquity.toFixed(2)}x</p>
          </div>
        </div>

        <!-- CHARTS -->
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div class="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <h3 class="font-bold text-slate-900 text-sm uppercase tracking-wider mb-6">Exposure by Owning LLC (Valuation)</h3>
            <div class="h-[300px] flex justify-center">
              <canvas id="exposureChart"></canvas>
            </div>
          </div>

          <div class="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
            <h3 class="font-bold text-slate-900 text-sm uppercase tracking-wider mb-6">Capital Stack (Debt vs Equity)</h3>
            <div class="h-[300px]">
              <canvas id="capitalStackChart"></canvas>
            </div>
          </div>
        </div>

        <!-- TABLE -->
        <div class="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div class="p-6 border-b border-gray-50">
            <h3 class="font-bold text-slate-900 text-sm uppercase tracking-wider">Property Yield Analysis</h3>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left">
              <thead class="bg-slate-50 border-b border-gray-100">
                <tr>
                  <th class="px-6 py-4 text-[10px] font-black text-gray-400 uppercase">Property</th>
                  <th class="px-6 py-4 text-[10px] font-black text-gray-400 uppercase">Owning LLC</th>
                  <th class="px-6 py-4 text-[10px] font-black text-gray-400 uppercase">Units</th>
                  <th class="px-6 py-4 text-[10px] font-black text-gray-400 uppercase">Occupancy</th>
                  <th class="px-6 py-4 text-[10px] font-black text-gray-400 uppercase">Valuation</th>
                  <th class="px-6 py-4 text-[10px] font-black text-gray-400 uppercase">Actual NOI</th>
                  <th class="px-6 py-4 text-[10px] font-black text-gray-400 uppercase">Cap Rate</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-50">
                ${this.renderYieldTable(filtered)}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    this.bindFilterEvents(container);
    requestAnimationFrame(() => this.initCharts(filtered));
  },

  bindFilterEvents(container) {
    if (this._bound) return;
    this._bound = true;

    // Create the debounced apply once
    if (!this._debouncedApply) {
      this._debouncedApply = debounce(() => this.render(), 250);
    }

    container.addEventListener('input', (e) => {
      const t = e.target;
      if (!t) return;

      // Debounced fields
      if (t.id === 'an-q') {
        this._filters.q = t.value || '';
        this._debouncedApply();
        return;
      }
      if (t.id === 'an-occ') {
        this._filters.min_occ = clamp(t.value, 0, 100);
        this._debouncedApply();
        return;
      }
      if (t.id === 'an-cap') {
        this._filters.min_cap = clamp(t.value, 0, 100);
        this._debouncedApply();
        return;
      }
      if (t.id === 'an-noi') {
        this._filters.min_noi = Math.max(0, num(t.value));
        this._debouncedApply();
        return;
      }
    });

    // Non-debounced select change (instant)
    container.addEventListener('change', (e) => {
      const t = e.target;
      if (!t) return;

      if (t.id === 'an-llc') {
        this._filters.owning_llc = t.value || 'all';
        this.render();
      }
    });

    // Instant reset
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('#an-reset');
      if (!btn) return;

      this._filters = { q: '', owning_llc: 'all', min_occ: 0, min_cap: 0, min_noi: 0 };
      this.render();
    });
  },

  applyFilters(properties, filters) {
    const q = (filters.q || '').toLowerCase().trim();
    const llc = filters.owning_llc || 'all';
    const minOcc = clamp(filters.min_occ, 0, 100);
    const minCap = Math.max(0, num(filters.min_cap));
    const minNoi = Math.max(0, num(filters.min_noi));

    return (properties || []).filter(p => {
      const name = (p.name || '').toString().toLowerCase();
      const owning = (p.owning_llc || '').toString();
      const occ = num(p.occupancy);

      const valuation = num(p.valuation);
      const noi = num(p.actual_noi);
      const cap = (valuation > 0 && noi > 0) ? ((noi / valuation) * 100) : 0;

      if (q && !name.includes(q)) return false;
      if (llc !== 'all' && owning !== llc) return false;
      if (occ < minOcc) return false;
      if (noi < minNoi) return false;
      if (cap < minCap) return false;

      return true;
    });
  },

  calculateMetrics(properties) {
    const props = Array.isArray(properties) ? properties : [];

    const capRates = props
      .map(p => {
        const val = num(p.valuation);
        const noi = num(p.actual_noi);
        if (val <= 0 || noi <= 0) return null;
        return (noi / val) * 100;
      })
      .filter(v => typeof v === 'number' && Number.isFinite(v));

    const totalValuation = props.reduce((sum, p) => sum + num(p.valuation), 0);
    const totalDebt = props.reduce((sum, p) => sum + num(p.loan_balance), 0);
    const totalEquity = Math.max(totalValuation - totalDebt, 0);
    const debtToEquity = totalEquity > 0 ? (totalDebt / totalEquity) : 0;

    return {
      avgCapRate: capRates.length ? avg(capRates) : 0,
      totalValuation,
      debtToEquity
    };
  },

  renderYieldTable(properties) {
    if (!properties || properties.length === 0) {
      return `<tr><td colspan="7" class="p-10 text-center text-gray-400 text-sm">No properties match your filters.</td></tr>`;
    }

    return properties.map(p => {
      const valuation = num(p.valuation);
      const noi = num(p.actual_noi);
      const cap = (valuation > 0 && noi > 0) ? ((noi / valuation) * 100) : 0;
      const occ = clamp(num(p.occupancy), 0, 100);

      return `
        <tr class="hover:bg-slate-50 transition-colors">
          <td class="px-6 py-4 font-bold text-slate-900 text-sm">${this.escapeHtml(p.name || '—')}</td>
          <td class="px-6 py-4 text-sm text-slate-600">${this.escapeHtml(p.owning_llc || '—')}</td>
          <td class="px-6 py-4 text-sm text-slate-600">${num(p.units) ? num(p.units) : '—'}</td>
          <td class="px-6 py-4 text-sm text-slate-600">${occ.toFixed(0)}%</td>
          <td class="px-6 py-4 text-sm text-slate-600">${formatters.compact(valuation)}</td>
          <td class="px-6 py-4 text-sm text-slate-600">${formatters.compact(noi)}</td>
          <td class="px-6 py-4 text-sm font-black text-emerald-600">${cap.toFixed(2)}%</td>
        </tr>
      `;
    }).join('');
  },

  initCharts(properties) {
    if (typeof Chart === 'undefined') {
      console.warn("Chart.js not loaded. Please ensure the CDN script is in index.html");
      return;
    }

    if (this._charts.exposure) {
      this._charts.exposure.destroy();
      this._charts.exposure = null;
    }
    if (this._charts.capitalStack) {
      this._charts.capitalStack.destroy();
      this._charts.capitalStack = null;
    }

    const props = Array.isArray(properties) ? properties : [];

    const map = {};
    props.forEach(p => {
      const llc = (p.owning_llc || 'Unknown').toString().trim() || 'Unknown';
      map[llc] = (map[llc] || 0) + num(p.valuation);
    });

    const labels = Object.keys(map).length ? Object.keys(map) : ['No Data'];
    const data = Object.keys(map).length ? Object.values(map) : [1];

    const totalValuation = props.reduce((sum, p) => sum + num(p.valuation), 0);
    const totalDebt = props.reduce((sum, p) => sum + num(p.loan_balance), 0);
    const totalEquity = Math.max(totalValuation - totalDebt, 0);
    const stackTotal = totalDebt + totalEquity;

    const debtPct = stackTotal > 0 ? (totalDebt / stackTotal) * 100 : 0;
    const equityPct = stackTotal > 0 ? (totalEquity / stackTotal) * 100 : 0;

    const exposureCtx = document.getElementById('exposureChart');
    if (exposureCtx) {
      this._charts.exposure = new Chart(exposureCtx, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data,
            borderWidth: 0
          }]
        },
        options: {
          cutout: '72%',
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom' },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const v = ctx?.raw ?? 0;
                  return `${ctx.label}: ${formatters.compact(v)}`;
                }
              }
            }
          }
        }
      });
    }

    const stackCtx = document.getElementById('capitalStackChart');
    if (stackCtx) {
      this._charts.capitalStack = new Chart(stackCtx, {
        type: 'bar',
        data: {
          labels: ['Portfolio Stack'],
          datasets: [
            { label: 'Debt', data: [debtPct], borderRadius: 6 },
            { label: 'Equity', data: [equityPct], borderRadius: 6 }
          ]
        },
        options: {
          indexAxis: 'y',
          maintainAspectRatio: false,
          scales: {
            x: { stacked: true, max: 100, display: false },
            y: { stacked: true, display: false }
          },
          plugins: {
            legend: { position: 'bottom' },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.raw || 0).toFixed(1)}%`
              }
            }
          }
        }
      });
    }
  },

  escapeHtml(s) {
    return String(s)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  },

  escapeAttr(s) {
    return this.escapeHtml(s);
  }
};
