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
            <div class="p-6">
                <div class="flex justify-between items-center mb-6">
                    <h2 class="text-2xl font-bold text-gray-800">Market Intelligence</h2>
                    <div class="flex gap-2">
                        <input type="text" id="market-zip-search" placeholder="Enter Zip Code..." 
                            class="px-4 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-orange-500">
                        <button data-action="fetch-market-data" class="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 font-medium">
                            Analyze Market
                        </button>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div class="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
                        <h3 class="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Demographics</h3>
                        <div id="market-demo-results" class="space-y-4">
                            <p class="text-gray-500 italic text-sm">Search a zip code to load census data...</p>
                        </div>
                    </div>

                    <div class="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div class="p-4 border-b border-gray-100 flex justify-between items-center">
                            <h3 class="text-sm font-bold text-gray-700 uppercase">Rent Comparables</h3>
                            <span class="text-xs text-orange-600 font-semibold bg-orange-50 px-2 py-1 rounded">Avg: $2.10/SF</span>
                        </div>
                        <table class="min-w-full divide-y divide-gray-200">
                            <thead class="bg-gray-50 text-[10px] font-bold text-gray-500 uppercase">
                                <tr>
                                    <th class="px-4 py-3 text-left">Property</th>
                                    <th class="px-4 py-3 text-left">Distance</th>
                                    <th class="px-4 py-3 text-left">Avg Rent</th>
                                    <th class="px-4 py-3 text-left">Year Built</th>
                                </tr>
                            </thead>
                            <tbody id="market-comps-tbody" class="divide-y divide-gray-100 text-sm">
                                </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },

    /**
     * Example logic to update the UI with "fetched" data
     */
    updateMarketDisplay(zipData) {
        const demoContainer = document.getElementById('market-demo-results');
        if (!demoContainer) return;

        demoContainer.innerHTML = `
            <div class="flex justify-between items-end border-b pb-2">
                <span class="text-xs text-gray-500">Population Growth</span>
                <span class="text-lg font-bold text-green-600">+4.2%</span>
            </div>
            <div class="flex justify-between items-end border-b pb-2">
                <span class="text-xs text-gray-500">Median HH Income</span>
                <span class="text-lg font-bold text-gray-800">${formatters.dollars(zipData.medianIncome || 72000)}</span>
            </div>
            <div class="flex justify-between items-end border-b pb-2">
                <span class="text-xs text-gray-500">Unemployment Rate</span>
                <span class="text-lg font-bold text-gray-800">3.1%</span>
            </div>
        `;
    },

    /**
     * Logic to calculate "Spread" between Market Cap Rates and Deal Cap Rates
     */
    calculateMarketSpread(dealCap, marketCap) {
        return ((dealCap - marketCap) * 100).toFixed(2) + " bps";
    }
};