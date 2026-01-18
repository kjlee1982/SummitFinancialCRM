/**
 * src/modules/market-analysis.js
 * Handles sub-market research, rent comps, and demographic trends.
 */

import { formatters } from '../utils/formatters.js';

export const marketAnalysis = {
    
    /**
     * Renders the Market Analysis View
     */
    render(state) {
        const container = document.getElementById('view-market-analysis');
        if (!container) return;

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
                                <span class="text-3xl font-black text-slate-900">84<span class="text-slate-300 text-lg">/100</span></span>
                                <span class="px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-black rounded uppercase">Strong Growth</span>
                            </div>
                            <div class="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                <div class="bg-orange-500 h-full w-[84%]"></div>
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
                                    <span class="text-[10px] font-bold text-slate-500 uppercase">Avg Rent: <b class="text-slate-900">$1,850</b></span>
                                    <span class="text-[10px] font-bold text-slate-500 uppercase">Avg PSF: <b class="text-orange-600">$2.15</b></span>
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
                                        ${this.renderPlaceholderComps()}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        
                        
                    </div>
                </div>
            </div>
        `;

        this.bindEvents();
    },

    bindEvents() {
        const btn = document.getElementById('analyze-market-btn');
        if (btn) {
            btn.onclick = () => {
                const zip = document.getElementById('market-zip-search').value;
                if(zip) this.updateMarketDisplay({ zip, medianIncome: 84500 });
            };
        }
    },

    /**
     * Updates the UI with "fetched" data
     */
    updateMarketDisplay(zipData) {
        const demoContainer = document.getElementById('market-demo-results');
        if (!demoContainer) return;

        demoContainer.innerHTML = `
            <div class="space-y-4">
                <div class="flex justify-between items-end border-b border-slate-50 pb-2">
                    <span class="text-[10px] font-black text-slate-400 uppercase">Pop. Growth (5yr)</span>
                    <span class="text-sm font-black text-emerald-600">+6.8%</span>
                </div>
                <div class="flex justify-between items-end border-b border-slate-50 pb-2">
                    <span class="text-[10px] font-black text-slate-400 uppercase">Median HH Income</span>
                    <span class="text-sm font-black text-slate-900">${formatters.dollars(zipData.medianIncome)}</span>
                </div>
                <div class="flex justify-between items-end border-b border-slate-50 pb-2">
                    <span class="text-[10px] font-black text-slate-400 uppercase">Owner Occupied</span>
                    <span class="text-sm font-black text-slate-900">58.2%</span>
                </div>
                <div class="flex justify-between items-end border-b border-slate-50 pb-2">
                    <span class="text-[10px] font-black text-slate-400 uppercase">Crime Index</span>
                    <span class="text-sm font-black text-blue-600">Low</span>
                </div>
            </div>
            <div class="mt-6 p-4 bg-orange-50 rounded-xl border border-orange-100">
                <p class="text-[11px] text-orange-800 leading-relaxed font-medium">
                    <i class="fa fa-lightbulb mr-1"></i> <b>Market Insight:</b> Higher than average income growth detected in ${zipData.zip || 'this area'}. Recommend Class-B value-add strategies.
                </p>
            </div>
        `;
    },

    renderPlaceholderComps() {
        const mockComps = [
            { name: 'The Highline Apartments', class: 'A', rent: 2150, psf: 2.45, occ: 96, dist: '0.4 mi' },
            { name: 'Oak Creek Village', class: 'B', rent: 1650, psf: 1.85, occ: 94, dist: '1.2 mi' },
            { name: 'Midtown Lofts', class: 'A-', rent: 1980, psf: 2.20, occ: 92, dist: '0.8 mi' }
        ];

        return mockComps.map(comp => `
            <tr class="hover:bg-slate-50 transition-colors">
                <td class="px-6 py-4 font-bold text-slate-900">${comp.name}</td>
                <td class="px-6 py-4"><span class="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-black">CLASS ${comp.class}</span></td>
                <td class="px-6 py-4 font-semibold text-slate-700">${formatters.dollars(comp.rent)}</td>
                <td class="px-6 py-4 font-medium text-slate-500">$${comp.psf}</td>
                <td class="px-6 py-4">
                    <div class="flex items-center gap-2">
                        <div class="w-12 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                            <div class="bg-emerald-500 h-full" style="width: ${comp.occ}%"></div>
                        </div>
                        <span class="text-[10px] font-bold">${comp.occ}%</span>
                    </div>
                </td>
                <td class="px-6 py-4 text-right text-xs font-bold text-slate-400">${comp.dist}</td>
            </tr>
        `).join('');
    },

    /**
     * Logic to calculate "Spread" between Market Cap Rates and Deal Cap Rates
     */
    calculateMarketSpread(dealCap, marketCap) {
        const spread = (dealCap - marketCap) * 100;
        return spread.toFixed(0) + " bps";
    }
};