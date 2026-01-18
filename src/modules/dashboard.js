/**
 * src/modules/dashboard.js
 * Enhanced with Chart.js visualizations and safety guards.
 */
import { stateManager } from '../state.js';
import { formatters } from '../utils/formatters.js';

export const dashboard = {
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
                            ${state.settings?.companyName || 'Summit Capital'}
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
                            <button class="text-[10px] font-black text-blue-600 hover:underline uppercase">View All</button>
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
                        <button data-action="nav-link" data-view="tasks" class="w-full mt-8 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold transition-all">
                            GO TO TASK MANAGER
                        </button>
                    </div>
                </div>
            </div>
        `;

        // Small delay to ensure the DOM elements are painted
        setTimeout(() => this.initCharts(state), 50);
    },

    initCharts(state) {
        if (typeof Chart === 'undefined') return;

        // --- 1. Allocation Doughnut ---
        const allocationCtx = document.getElementById('allocationChart');
        if (allocationCtx && state.properties?.length > 0) {
            new Chart(allocationCtx, {
                type: 'doughnut',
                data: {
                    labels: state.properties.map(p => p.name),
                    datasets: [{
                        data: state.properties.map(p => parseFloat(p.valuation) || 0),
                        backgroundColor: ['#0f172a', '#ea580c', '#64748b', '#94a3b8', '#cbd5e1'],
                        borderWidth: 0,
                        hoverOffset: 15
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { boxWidth: 10, font: { weight: 'bold', size: 9 } } }
                    },
                    cutout: '75%'
                }
            });
        }

        // --- 2. Pipeline Bar ---
        const pipelineCtx = document.getElementById('pipelineChart');
        if (pipelineCtx) {
            const stages = ['Leads', 'LOI', 'DD', 'Closing'];
            const deals = state.deals || [];
            const stageData = stages.map(s => deals.filter(d => d.stage === s).length);

            new Chart(pipelineCtx, {
                type: 'bar',
                data: {
                    labels: stages,
                    datasets: [{
                        data: stageData,
                        backgroundColor: '#ea580c',
                        borderRadius: 6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { stepSize: 1 } },
                        x: { grid: { display: false } }
                    }
                }
            });
        }
    },

    calculateStats(state) {
        const props = state.properties || [];
        const deals = state.deals || [];
        const projects = state.projects || [];

        return {
            aum: props.reduce((sum, p) => sum + (parseFloat(p.valuation) || 0), 0),
            pipeline: deals.reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0),
            capex: projects.reduce((sum, p) => sum + (parseFloat(p.budget) || 0), 0),
            occupancy: props.length 
                ? (props.reduce((sum, p) => sum + (parseFloat(p.occupancy) || 0), 0) / props.length).toFixed(1)
                : 0
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
                <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">${label}</p>
                <p class="text-2xl font-black text-slate-900">${value}</p>
            </div>
        `;
    },

    renderActivityList(activities) {
        if (!activities || activities.length === 0) {
            return `<div class="p-10 text-center text-gray-400 text-xs">No recent activity detected.</div>`;
        }
        return activities.slice(0, 10).map(act => `
            <div class="flex items-center gap-4 px-6 py-4 border-b border-gray-50 hover:bg-slate-50 transition-colors">
                <div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-xs">
                    <i class="fa ${act.type === 'add' ? 'fa-plus text-emerald-500' : 'fa-pen text-blue-500'}"></i>
                </div>
                <div class="flex-grow">
                    <p class="text-sm font-bold text-slate-800">${act.text}</p>
                    <p class="text-[10px] text-gray-400 font-medium">${new Date(act.at).toLocaleDateString()}</p>
                </div>
            </div>
        `).join('');
    },

    renderUrgentTasks(tasks) {
        const tks = tasks || [];
        const urgent = tks.filter(t => !t.completed).slice(0, 5);
        if (urgent.length === 0) return `<p class="text-slate-500 text-xs text-center py-4">No pending tasks.</p>`;
        return urgent.map(t => `
            <div class="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer">
                <div class="w-2 h-2 rounded-full bg-orange-500 shadow-[0_0_8px_rgba(234,88,12,0.6)]"></div>
                <div>
                    <p class="text-sm font-bold text-slate-100">${t.task}</p>
                    <p class="text-[10px] text-slate-500 uppercase font-bold">${t.due || 'ASAP'}</p>
                </div>
            </div>
        `).join('');
    }
};