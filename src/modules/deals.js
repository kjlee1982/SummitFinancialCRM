/**
 * src/modules/deals.js
 * Manages the Acquisition Pipeline with integrated Financial Underwriting.
 */

import { stateManager } from '../state.js';
import { formatters } from '../utils/formatters.js';
import { modalManager } from '../utils/modals.js';
import { calc } from '../utils/calculations.js';

export function renderDeals(deals) {
    const container = document.getElementById('view-deals');
    if (!container) return;

    const totalVolume = deals.reduce((sum, d) => sum + (parseFloat(d.price) || 0), 0);

    container.innerHTML = `
        <div class="p-6">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 class="text-2xl font-bold text-gray-900">Acquisition Pipeline</h2>
                    <p class="text-sm text-gray-500 font-medium">
                        Tracking ${deals.length} opportunities • Total Volume: ${formatters.dollars(totalVolume)}
                    </p>
                </div>
                <button data-action="deal-add" class="bg-slate-900 text-white px-5 py-2.5 rounded-lg hover:bg-slate-800 font-bold shadow-sm transition-all flex items-center text-sm">
                    <i class="fa fa-plus mr-2"></i>Add Deal
                </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                ${renderDealCards(deals)}
            </div>
        </div>
    `;
}

function renderDealCards(deals) {
    if (deals.length === 0) return `<div class="col-span-full py-20 text-center text-gray-400">No deals found.</div>`;

    return deals.map(deal => {
        // Calculate dynamic metrics using our new engine
        const totalBasis = calc.totalBasis(deal.price, deal.closing_costs, deal.rehab);
        const yoc = calc.yieldOnCost(deal.proforma_noi, totalBasis);
        const ppu = calc.pricePerUnit(deal.price, deal.units);

        return `
            <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:border-orange-300 transition-all group">
                <div class="p-5">
                    <div class="flex justify-between items-start mb-4">
                        <span class="px-2 py-1 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600">
                            ${deal.stage || 'Sourced'}
                        </span>
                        <div class="flex gap-2">
                            <button data-action="deal-edit" data-id="${deal.id}" class="text-gray-400 hover:text-slate-600"><i class="fa fa-pen text-xs"></i></button>
                            <button data-action="deal-delete" data-id="${deal.id}" class="text-gray-400 hover:text-red-500"><i class="fa fa-trash text-xs"></i></button>
                        </div>
                    </div>
                    
                    <h3 class="font-bold text-gray-900 text-lg mb-1">${deal.name}</h3>
                    <p class="text-xs text-gray-500 mb-4 truncate"><i class="fa fa-map-marker-alt mr-1"></i>${deal.address || 'Address not set'}</p>

                    <div class="grid grid-cols-2 gap-4 border-t border-gray-50 pt-4">
                        <div>
                            <p class="text-[10px] text-gray-400 font-bold uppercase">Purchase Price</p>
                            <p class="text-sm font-bold text-gray-900">${formatters.dollars(deal.price)}</p>
                        </div>
                        <div>
                            <p class="text-[10px] text-gray-400 font-bold uppercase">Yield on Cost</p>
                            <p class="text-sm font-bold text-orange-600">${yoc}%</p>
                        </div>
                        <div>
                            <p class="text-[10px] text-gray-400 font-bold uppercase">Total Basis</p>
                            <p class="text-sm font-medium text-gray-700">${formatters.dollars(totalBasis)}</p>
                        </div>
                        <div>
                            <p class="text-[10px] text-gray-400 font-bold uppercase">$/Unit</p>
                            <p class="text-sm font-medium text-gray-700">${formatters.dollars(ppu)}</p>
                        </div>
                    </div>
                </div>
                
                <div class="bg-gray-50 px-5 py-3 flex justify-between items-center">
                    <span class="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Units: ${deal.units || 0}</span>
                    <button data-action="deal-docs" data-id="${deal.id}" class="text-xs font-bold text-slate-600 hover:text-orange-600">
                        View Files <i class="fa fa-chevron-right ml-1"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Enhanced Modal with Underwriting Inputs
 */
export function showAddDealModal() {
    const formHtml = `
        <div class="grid grid-cols-2 gap-4">
            <div class="col-span-2">
                <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Deal Name</label>
                <input type="text" id="name" class="w-full p-3 border rounded-lg" placeholder="e.g. Phoenix Portfolio">
            </div>
            <div class="col-span-2">
                <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Address</label>
                <input type="text" id="address" class="w-full p-3 border rounded-lg" placeholder="123 Investment St.">
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Purchase Price</label>
                <input type="number" id="price" class="w-full p-3 border rounded-lg">
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Pipeline Stage</label>
                <select id="stage" class="w-full p-3 border rounded-lg">
                    <option>Sourced</option>
                    <option>Underwriting</option>
                    <option>LOI Sent</option>
                    <option>Closing</option>
                </select>
            </div>
            <div class="col-span-2"><hr class="my-2 border-gray-100"></div>
            <div>
                <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Rehab Budget</label>
                <input type="number" id="rehab" class="w-full p-3 border rounded-lg" placeholder="0">
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Closing Costs</label>
                <input type="number" id="closing_costs" class="w-full p-3 border rounded-lg" placeholder="0">
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Total Units</label>
                <input type="number" id="units" class="w-full p-3 border rounded-lg">
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Pro-Forma NOI (Annual)</label>
                <input type="number" id="proforma_noi" class="w-full p-3 border rounded-lg">
            </div>
        </div>
    `;

    modalManager.show("Add New Opportunity", formHtml, (data) => {
        stateManager.add('deals', data);
    });
}