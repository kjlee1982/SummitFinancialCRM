/**
 * src/modules/dashboard.js
 * Enhanced with Chart.js visualizations and safety guards.
 *
 * Improvements:
 * - Destroy Chart instances on re-render to prevent leaks
 * - Dynamic pipeline stage aggregation (no hardcoded stage strings)
 * - "View All" navigates to Activity view
 * - Safe activity date formatting (no Invalid Date)
 * - Occupancy always numeric
 * - Better activity icon mapping
 * - Uses requestAnimationFrame instead of setTimeout
 */
import { stateManager } from '../state.js';
import { formatters } from '../utils/formatters.js';

function safeNumber(v) {
  const n = typeof v === 'string' ? Number(v.replace(/,/g, '').trim()) : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function safeDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function round1(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 10) / 10;
}

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getActivityIcon(act) {
  const type = String(act?.type || '').toLowerCase();
  const text = String(act?.text || '').toLowerCase();

  // Type-first mapping (preferred)
  if (type.includes('delete') || type.includes('remove')) return { icon: 'fa-trash', cls: 'text-red-500' };
  if (type.includes('add') || type.includes('create')) return { icon: 'fa-plus', cls: 'text-emerald-500' };
  if (type.includes('update') || type.includes('edit')) return { icon: 'fa-pen', cls: 'text-blue-500' };
  if (type.includes('stage')) return { icon: 'fa-arrow-right', cls: 'text-indigo-500' };

  // Keyword fallback
  if (text.includes('delete') || text.includes('removed')) return { icon: 'fa-trash', cls: 'text-red-500' };
  if (text.includes('added') || text.includes('created')) return { icon: 'fa-plus', cls: 'text-emerald-500' };
  if (text.includes('updated') || text.includes('edited')) return { icon: 'fa-pen', cls: 'text-blue-500' };
  if (text.includes('stage') || text.includes('moved')) return { icon: 'fa-arrow-right', cls: 'text-indigo-500' };

  return { icon: 'fa-info-circle', cls: 'text-slate-400' };
}

export const dashboard = {
  _charts: {
    allocation: null,
    pipeline: null
  },

  render() {
    const container = document.getElementById('view-dashboard');
    if (!container) return;

    const state = stateManager.get();
    const stats = this.calculateStats(state);

    container.innerHTML = `
      <div class="p-8 space-y-8">
        <div class="flex justify-between items-end">
          <div>
            <h1 class="text-3xl font-black text-slate-900 tracking-tight">
              ${escapeHtml(state.settings?.companyName || 'Summit Capital')}
            </h1>
            <p class="text-sm text-gray-500 font-bold uppercase tracking-wider">Portfolio Command Center</p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          ${this.renderStatCard("Portfolio AUM", formatters.compact(stats.aum), "fa-building", "text-blue-600")}
          ${this.renderStatCard("Pipeline", formatters.compact(stats.pipeline), "fa-rocket", "text-orange-600")}
          ${this.renderStatCard("CapEx Reserves", formatters.compact(stats.capex), "fa-helmet-safety", "text-amber-600")}
          ${this.renderStatCard("Portfolio Occupancy", `${stats.occupancy}%`, "fa-house-user", "text-emerald-600")}
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div class="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <h3 class="font-bold text-slate-900 text-sm uppercase tracking-wider mb-6">Asset Allocation</h3>
            <div class="h-[250px] flex items-center justify-center">
              <canvas id="allocationChart"></canvas>
            </div>
          </div>

          <div class="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
            <h3 class="font-bold text-slate-900 text-sm uppercase tracking-wider mb-6">Pipeline by Stage</h3>
            <div class="h-[250px]">
              <canvas id="pipelineChart"></canvas>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div class="xl:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div class="p-6 border-b border-gray-50 flex justify-between items-center">
              <h3 class="font-bold text-slate-900 text-sm uppercase tracking-wider">Recent Activity</h3>
              <button data-action="nav-link" data-view="activity"
                class="text-[10px] font-black text-blue-600 hover:underline uppercase">
                View All
              </button>
            </div>
            <div class="max-h-[400px] overflow-y-auto no-scrollbar">
              ${this.renderActivityList(state.activities)}
            </div>
          </div>

          <div class="bg-slate-900 rounded-2xl shadow-xl p-6 text-white h-fit">
            <h3 class="font-bold text-sm uppercase tracking-wider mb-6 text-slate-400">Critical Tasks</h3>
            <div class="space-y-4">
              ${this.renderUrgentTasks(state.tasks)}
            </div>
            <button data-action="nav-link" data-view="tasks"
              class="w-full mt-8 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold transition-all">
              GO TO TASK MANAGER
            </button>
          </div>
        </div>
      </div>
    `;

    // Ensure DOM is ready for canvas elements
    requestAnimationFrame(() => this.initCharts(state));
  },

  initCharts(state) {
    if (typeof Chart === 'undefined') return;

    // Destroy old charts to prevent memory leaks
    if (this._charts.allocation) {
      this._charts.allocation.destroy();
      this._charts.allocation = null;
    }
    if (this._charts.pipeline) {
      this._charts.pipeline.destroy();
      this._charts.pipeline = null;
    }

    // --- 1) Allocation Doughnut ---
    const allocationCtx = document.getElementById('allocationChart');
    const props = Array.isArray(state?.properties) ? state.properties : [];

    if (allocationCtx && props.length > 0) {
      const labels = props.map(p => String(p?.name || 'Unnamed'));
      const values = props.map(p => safeNumber(p?.valuation));

      this._charts.allocation = new Chart(allocationCtx, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data: values,
            borderWidth: 0,
            hoverOffset: 12
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { boxWidth: 10, font: { weight: 'bold', size: 9 } }
            },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.label}: ${formatters.compact(ctx?.raw ?? 0)}`
              }
            }
          },
          cutout: '75%'
        }
      });
    }

    // --- 2) Pipeline Bar (dynamic stages) ---
    const pipelineCtx = document.getElementById('pipelineChart');
    const deals = Array.isArray(state?.deals) ? state.deals : [];

    if (pipelineCtx) {
      // Build stage buckets dynamically from deal data
      const counts = {};
      deals.forEach(d => {
        const stage = String(d?.stage || 'Unstaged').trim() || 'Unstaged';
        counts[stage] = (counts[stage] || 0) + 1;
      });

      // Sort stages by count desc, then name asc (stable, readable)
      const stages = Object.keys(counts).sort((a, b) => {
        const dc = (counts[b] || 0) - (counts[a] || 0);
        if (dc !== 0) return dc;
        return a.localeCompare(b);
      });

      // If no deals, show empty baseline
      const labels = stages.length ? stages : ['No Deals'];
      const data = stages.length ? stages.map(s => counts[s]) : [0];

      this._charts.pipeline = new Chart(pipelineCtx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            data,
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { stepSize: 1 },
              grid: { color: '#f1f5f9' }
            },
            x: { grid: { display: false } }
          }
        }
      });
    }
  },

  calculateStats(state) {
    const props = Array.isArray(state?.properties) ? state.properties : [];
    const deals = Array.isArray(state?.deals) ? state.deals : [];
    const projects = Array.isArray(state?.projects) ? state.projects : [];

    const aum = props.reduce((sum, p) => sum + safeNumber(p?.valuation), 0);
    const pipeline = deals.reduce((sum, d) => sum + safeNumber(d?.value), 0);
    const capex = projects.reduce((sum, p) => sum + safeNumber(p?.budget), 0);

    const occAvg = props.length
      ? props.reduce((sum, p) => sum + safeNumber(p?.occupancy), 0) / props.length
      : 0;

    return {
      aum,
      pipeline,
      capex,
      occupancy: round1(occAvg)
    };
  },

  renderStatCard(label, value, icon, iconColor) {
    return `
      <div class="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm transition-transform hover:scale-[1.02]">
        <div class="flex justify-between items-start mb-4">
          <div class="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center ${iconColor}">
            <i class="fa ${icon} text-lg"></i>
          </div>
        </div>
        <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">${escapeHtml(label)}</p>
        <p class="text-2xl font-black text-slate-900">${escapeHtml(value)}</p>
      </div>
    `;
  },

  renderActivityList(activities) {
    const list = Array.isArray(activities) ? activities : [];
    if (list.length === 0) {
      return `<div class="p-10 text-center text-gray-400 text-xs">No recent activity detected.</div>`;
    }

    return list.slice(0, 10).map(act => {
      const { icon, cls } = getActivityIcon(act);
      const dt = safeDate(act?.at);
      const dateLabel = dt ? dt.toLocaleDateString() : '—';

      return `
        <div class="flex items-center gap-4 px-6 py-4 border-b border-gray-50 hover:bg-slate-50 transition-colors">
          <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-xs">
            <i class="fa ${icon} ${cls}"></i>
          </div>
          <div class="flex-grow">
            <p class="text-sm font-bold text-slate-800">${escapeHtml(act?.text || '')}</p>
            <p class="text-[10px] text-gray-400 font-medium">${escapeHtml(dateLabel)}</p>
          </div>
        </div>
      `;
    }).join('');
  },

  renderUrgentTasks(tasks) {
    const tks = Array.isArray(tasks) ? tasks : [];
    const urgent = tks.filter(t => !t?.completed).slice(0, 5);

    if (urgent.length === 0) {
      return `<p class="text-slate-500 text-xs text-center py-4">No pending tasks.</p>`;
    }

    return urgent.map(t => `
      <div class="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer">
        <div class="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(234,88,12,0.6)]"></div>
        <div>
          <p class="text-sm font-bold text-slate-100">${escapeHtml(t?.task || '')}</p>
          <p class="text-[10px] text-slate-500 uppercase font-bold">${escapeHtml(t?.due || 'ASAP')}</p>
        </div>
      </div>
    `).join('');
  }
};
