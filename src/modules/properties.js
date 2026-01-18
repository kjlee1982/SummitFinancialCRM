/**
 * src/modules/properties.js
 * Manages the Stabilized Portfolio and Asset Management metrics.
 */

import { stateManager } from '../state.js';
import { formatters } from '../utils/formatters.js';
import { modalManager } from '../utils/modals.js';
import { calc } from '../utils/calculations.js';

export function renderProperties(properties) {
    const container = document.getElementById('view-properties');
    if (!container) return;

    // 1. Portfolio Calculations
    const totalValue = properties.reduce((sum, p) => sum + (parseFloat(p.valuation) || 0), 0);
    const totalUnits = properties.reduce((sum, p) => sum + (parseInt(p.units) || 0), 0);
    const avgOccupancy = properties.length 
        ? (properties.reduce((sum, p) => sum + (parseFloat(p.occupancy) || 0), 0) / properties.length).toFixed(1)
        : 0;

    container.innerHTML = `
        <div class="p-6">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 class="text-2xl font-bold text-gray-900">Property Portfolio</h2>
                    <p class="text-sm text-gray-500 font-medium">
                        Managing ${properties.length} Assets • ${totalUnits} Total Units • ${formatters.compact(totalValue)} AUM
                    </p>
                </div>
                <button data-action="property-add" class="bg-slate-900 text-white px-5 py-2.5 rounded-lg hover:bg-slate-800 font-bold shadow-sm transition-all flex items-center text-sm">
                    <i class="fa fa-plus mr-2"></i>Add Property
                </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div class="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                    <p class="text-xs font-bold text-gray-400 uppercase mb-1">Avg Occupancy</p>
                    <p class="text-2xl font-bold text-slate-900">${avgOccupancy}%</p>
                </div>
                <div class="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                    <p class="text-xs font-bold text-gray-400 uppercase mb-1">Total Valuation</p>
                    <p class="text-2xl font-bold text-slate-900">${formatters.dollars(totalValue)}</p>
                </div>
                <div class="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                    <p class="text-xs font-bold text-gray-400 uppercase mb-1">Avg $/Unit</p>
                    <p class="text-2xl font-bold text-slate-900">${formatters.dollars(totalUnits ? totalValue / totalUnits : 0)}</p>
                </div>
            </div>

            <div class="grid grid-cols-1 xl:grid-cols-2 gap-6">
                ${renderPropertyCards(properties)}
            </div>
        </div>
    `;
}

function renderPropertyCards(properties) {
    if (properties.length === 0) return `<div class="col-span-full py-20 text-center text-gray-400 border-2 border-dashed rounded-xl bg-white">No properties in portfolio.</div>`;

    return properties.map(prop => {
        const ltv = calc.ltv(prop.loan_balance, prop.valuation);
        const occupancyColor = prop.occupancy < 90 ? 'text-red-600' : 'text-green-600';

        return `
            <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col md:flex-row hover:border-slate-400 transition-all">
                <div class="w-full md:w-40 bg-slate-100 flex flex-col items-center justify-center p-4 border-r border-gray-50">
                    <i class="fa fa-building text-3xl text-slate-300 mb-2"></i>
                    <span class="text-[10px] font-black text-slate-500 uppercase">${prop.units} Units</span>
                </div>

                <div class="flex-grow p-6">
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <h3 class="font-bold text-gray-900 text-lg">${prop.name}</h3>
                            <div class="flex items-center gap-2 mt-1">
                                <span class="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                                    <i class="fa fa-scale-balanced mr-1 opacity-50"></i>${prop.owning_llc || 'Personal/Other'}
                                </span>
                            </div>
                        </div>
                        <div class="flex gap-2">
                            <button data-action="prop-delete" data-id="${prop.id}" class="text-gray-300 hover:text-red-500 transition-colors">
                                <i class="fa fa-trash-alt"></i>
                            </button>
                        </div>
                    </div>

                    <div class="grid grid-cols-3 gap-4 py-4 border-t border-gray-50">
                        <div>
                            <p class="text-[10px] text-gray-400 font-bold uppercase mb-1">Occupancy</p>
                            <p class="text-sm font-black ${occupancyColor}">${prop.occupancy}%</p>
                        </div>
                        <div>
                            <p class="text-[10px] text-gray-400 font-bold uppercase mb-1">NOI (Actual)</p>
                            <p class="text-sm font-black text-gray-900">${formatters.compact(prop.actual_noi)}</p>
                        </div>
                        <div>
                            <p class="text-[10px] text-gray-400 font-bold uppercase mb-1">LTV</p>
                            <p class="text-sm font-black text-gray-900">${ltv}%</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Enhanced Modal to add a Stabilized Asset with LLC Selection
 */
export function showAddPropertyModal() {
    const state = stateManager.get();
    
    // Create LLC options dynamically from your legal entities module
    const llcOptions = state.llcs.map(llc => 
        `<option value="${llc.name}">${llc.name}</option>`
    ).join('');

    const formHtml = `
        <div class="grid grid-cols-2 gap-4">
            <div class="col-span-2">
                <label class="block text-xs font-black text-gray-400 uppercase mb-1">Property Name</label>
                <input type="text" id="name" class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-slate-900 outline-none">
            </div>
            <div class="col-span-2">
                <label class="block text-xs font-black text-gray-400 uppercase mb-1">Holding Entity (LLC)</label>
                <select id="owning_llc" class="w-full p-3 border rounded-lg outline-none text-sm">
                    <option value="">Select an Entity...</option>
                    ${llcOptions}
                </select>
            </div>
            <div>
                <label class="block text-xs font-black text-gray-400 uppercase mb-1">Current Valuation</label>
                <input type="number" id="valuation" class="w-full p-3 border rounded-lg outline-none">
            </div>
            <div>
                <label class="block text-xs font-black text-gray-400 uppercase mb-1">Loan Balance</label>
                <input type="number" id="loan_balance" class="w-full p-3 border rounded-lg outline-none">
            </div>
            <div>
                <label class="block text-xs font-black text-gray-400 uppercase mb-1">Unit Count</label>
                <input type="number" id="units" class="w-full p-3 border rounded-lg outline-none">
            </div>
            <div>
                <label class="block text-xs font-black text-gray-400 uppercase mb-1">Occupancy %</label>
                <input type="number" id="occupancy" class="w-full p-3 border rounded-lg outline-none" placeholder="95">
            </div>
            <div class="col-span-2">
                <label class="block text-xs font-black text-gray-400 uppercase mb-1">Annual Actual NOI</label>
                <input type="number" id="actual_noi" class="w-full p-3 border rounded-lg outline-none">
            </div>
        </div>
    `;

    modalManager.show("Add Stabilized Asset", formHtml, (data) => {
        stateManager.add('properties', data);
    });
}