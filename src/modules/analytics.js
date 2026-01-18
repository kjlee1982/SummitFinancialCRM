/**
 * src/modules/analytics.js
 * Advanced financial modeling and portfolio health visualizations.
 */
import { stateManager } from '../state.js';
import { formatters } from '../utils/formatters.js';

export const analytics = {
    render() {
        const container = document.getElementById('view-analytics');
        if (!container) return;

        const state = stateManager.get();
        const metrics = this.calculateMetrics(state);

        container.innerHTML = `
            <div class="p-8 space-y-8">
                <div>
                    <h2 class="text-2xl font-black text-slate-900 tracking-tight">Financial Analytics</h2>
                    <p class="text-sm text-gray-500 font-medium">Deep dive into portfolio yield, debt-to-equity, and asset distribution.</p>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Portfolio Cap Rate (Avg)</p>
                        <p class="text-2xl font-black text-slate-900">${metrics.avgCapRate}%</p>
                    </div>
                    <div class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Debt Service Coverage (DSCR)</p>
                        <p class="text-2xl font-black text-blue-600">${metrics.dscr}x</p>
                    </div>
                    <div class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Equity Multiplier</p>
                        <p class="text-2xl font-black text-emerald-600">${metrics.equityMultiplier}x</p>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div class="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                        <h3 class="font-bold text-slate-900 text-sm uppercase tracking-wider mb-6">Market Exposure by Asset Type</h3>
                        <div class="h-[300px] flex justify-center">
                            <canvas id="assetMixChart"></canvas>
                        </div>
                    </div>

                    <div class="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                        <h3 class="font-bold text-slate-900 text-sm uppercase tracking-wider mb-6">Capital Stack Breakdown</h3>
                        <div class="h-[300px]">
                            <canvas id="capitalStackChart"></canvas>
                        </div>
                    </div>
                </div>

                <div class="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                    <div class="p-6 border-b border-gray-50">
                        <h3 class="font-bold text-slate-900 text-sm uppercase tracking-wider">Property Yield Analysis</h3>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left">
                            <thead class="bg-slate-50 border-b border-gray-100">
                                <tr>
                                    <th class="px-6 py-4 text-[10px] font-black text-gray-400 uppercase">Property</th>
                                    <th class="px-6 py-4 text-[10px] font-black text-gray-400 uppercase">Valuation</th>
                                    <th class="px-6 py-4 text-[10px] font-black text-gray-400 uppercase">NOI (Est)</th>
                                    <th class="px-6 py-4 text-[10px] font-black text-gray-400 uppercase">Yield</th>
                                    <th class="px-6 py-4 text-[10px] font-black text-gray-400 uppercase">Status</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-gray-50">
                                ${this.renderYieldTable(state.properties || [])}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        // Delay chart initialization slightly to ensure canvas is in DOM
        setTimeout(() => this.initCharts(state), 100);
    },

    calculateMetrics(state) {
        return {
            avgCapRate: 5.8,
            dscr: 1.45,
            equityMultiplier: 2.1
        };
    },

    renderYieldTable(properties) {
        if (!properties || properties.length === 0) {
            return `<tr><td colspan="5" class="p-10 text-center text-gray-400 text-sm">Add properties to generate yield data.</td></tr>`;
        }
        
        return properties.map(p => {
            const valuation = parseFloat(p.valuation) || 0;
            const noi = valuation * 0.06; // Assuming 6% NOI for demo
            const yieldVal = valuation > 0 ? ((noi / valuation) * 100).toFixed(2) : "0.00";

            return `
                <tr class="hover:bg-slate-50 transition-colors">
                    <td class="px-6 py-4 font-bold text-slate-900 text-sm">${p.name}</td>
                    <td class="px-6 py-4 text-sm text-slate-600">${formatters.compact(valuation)}</td>
                    <td class="px-6 py-4 text-sm text-slate-600">${formatters.compact(noi)}</td>
                    <td class="px-6 py-4 text-sm font-bold text-emerald-600">${yieldVal}%</td>
                    <td class="px-6 py-4">
                        <span class="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-black uppercase">Stabilized</span>
                    </td>
                </tr>
            `;
        }).join('');
    },

    initCharts(state) {
        // Safety check for Chart.js library
        if (typeof Chart === 'undefined') {
            console.warn("Chart.js not loaded. Please ensure the CDN script is in index.html");
            return;
        }

        // --- 1. ASSET MIX (Doughnut) ---
        const mixCtx = document.getElementById('assetMixChart');
        if (mixCtx) {
            new Chart(mixCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Multifamily', 'Retail', 'Industrial', 'Office'],
                    datasets: [{
                        data: [55, 15, 20, 10],
                        backgroundColor: ['#0f172a', '#ea580c', '#334155', '#94a3b8'],
                        borderWidth: 0
                    }]
                },
                options: { 
                    cutout: '75%', 
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } } 
                }
            });
        }

        // --- 2. CAPITAL STACK (Stacked Bar) ---
        const stackCtx = document.getElementById('capitalStackChart');
        if (stackCtx) {
            new Chart(stackCtx, {
                type: 'bar',
                data: {
                    labels: ['Current Portfolio Stack'],
                    datasets: [
                        { label: 'Senior Debt', data: [65], backgroundColor: '#1e293b', borderRadius: 5 },
                        { label: 'Mezzanine', data: [10], backgroundColor: '#ea580c', borderRadius: 5 },
                        { label: 'Equity', data: [25], backgroundColor: '#10b981', borderRadius: 5 }
                    ]
                },
                options: {
                    indexAxis: 'y',
                    maintainAspectRatio: false,
                    scales: { 
                        x: { stacked: true, max: 100, display: false }, 
                        y: { stacked: true, display: false } 
                    },
                    plugins: { legend: { position: 'bottom' } }
                }
            });
        }
    }
};