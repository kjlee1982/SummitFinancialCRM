/**
 * src/modules/deals.js
 * Manages the Acquisition Pipeline with integrated Financial Underwriting.
 */

import { stateManager } from '../state.js';
import { formatters } from '../utils/formatters.js';
import { modalManager } from '../utils/modals.js';
import { dealAnalyzer } from './deal-analyzer.js';

export const deals = {
    /**
     * Main render function called by the router
     */
    render(state) {
        const container = document.getElementById('view-deals');
        if (!container) return;

        const dealList = state.deals || [];
        const totalVolume = dealList.reduce((sum, d) => sum + (parseFloat(d.price) || 0), 0);

        container.innerHTML = `
            <div class="p-6">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h2 class="text-2xl font-bold text-gray-900">Acquisition Pipeline</h2>
                        <p class="text-sm text-gray-500 font-medium">
                            Tracking ${dealList.length} opportunities • Total Volume: ${formatters.dollars(totalVolume)}
                        </p>
                    </div>
                    <button id="add-deal-btn" class="bg-slate-900 text-white px-5 py-2.5 rounded-lg hover:bg-slate-800 font-bold shadow-sm transition-all flex items-center text-sm">
                        <i class="fa fa-plus mr-2"></i>Add Deal
                    </button>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                    ${this.renderDealCards(dealList)}
                </div>
            </div>
        `;

        this.bindEvents();
    },

    renderDealCards(dealList) {
        if (dealList.length === 0) {
            return `
                <div class="col-span-full py-20 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-white">
                    <i class="fa fa-handshake text-4xl mb-3 opacity-20"></i>
                    <p>No active deals in the pipeline.</p>
                </div>`;
        }

        return dealList.map(deal => {
            // Mapping existing keys to match dealAnalyzer expectations
            const analysisData = {
                purchase_price: deal.price,
                annual_gross_income: deal.proforma_noi, // Simplified for card view
                annual_expenses: 0,
                annual_debt_service: 0,
                total_capex: (parseFloat(deal.rehab) || 0) + (parseFloat(deal.closing_costs) || 0)
            };

            const metrics = dealAnalyzer.analyze(analysisData);
            const ppu = deal.units > 0 ? (parseFloat(deal.price) || 0) / deal.units : 0;

            return `
                <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:border-orange-300 transition-all group">
                    <div class="p-5">
                        <div class="flex justify-between items-start mb-4">
                            <span class="px-2 py-1 rounded text-[10px] font-bold uppercase ${this.getStageClass(deal.stage)}">
                                ${deal.stage || 'Sourced'}
                            </span>
                            <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button data-action="deal-delete" data-id="${deal.id}" class="text-gray-400 hover:text-red-500">
                                    <i class="fa fa-trash text-xs"></i>
                                </button>
                            </div>
                        </div>
                        
                        <h3 class="font-bold text-gray-900 text-lg mb-1 truncate">${deal.name}</h3>
                        <p class="text-xs text-gray-500 mb-4 truncate">
                            <i class="fa fa-map-marker-alt mr-1"></i>${deal.address || 'Address not set'}
                        </p>

                        <div class="grid grid-cols-2 gap-4 border-t border-gray-50 pt-4">
                            <div>
                                <p class="text-[10px] text-gray-400 font-bold uppercase">Purchase Price</p>
                                <p class="text-sm font-bold text-gray-900">${formatters.dollars(deal.price)}</p>
                            </div>
                            <div>
                                <p class="text-[10px] text-gray-400 font-bold uppercase">Yield on Cost</p>
                                <p class="text-sm font-bold text-orange-600">${formatters.percent(metrics.yieldOnCost)}</p>
                            </div>
                            <div>
                                <p class="text-[10px] text-gray-400 font-bold uppercase">Total Basis</p>
                                <p class="text-sm font-medium text-gray-700">${formatters.dollars(metrics.totalBasis)}</p>
                            </div>
                            <div>
                                <p class="text-[10px] text-gray-400 font-bold uppercase">$/Unit</p>
                                <p class="text-sm font-medium text-gray-700">${formatters.dollars(ppu)}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="bg-gray-50 px-5 py-3 flex justify-between items-center">
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Units: ${deal.units || 0}</span>
                        <button data-action="deal-details" data-id="${deal.id}" class="text-xs font-bold text-slate-600 hover:text-orange-600 transition-colors">
                            Analyze Deal <i class="fa fa-chevron-right ml-1"></i>
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    },

    bindEvents() {
        const addBtn = document.getElementById('add-deal-btn');
        if (addBtn) addBtn.onclick = () => this.showAddDealModal();

        // Delete Logic
        document.querySelectorAll('[data-action="deal-delete"]').forEach(btn => {
            btn.onclick = (e) => {
                const id = e.currentTarget.dataset.id;
                if (confirm("Remove this deal from pipeline?")) {
                    stateManager.delete('deals', id);
                }
            };
        });
    },

    showAddDealModal() {
        const formHtml = `
            <div class="grid grid-cols-2 gap-4">
                <div class="col-span-2">
                    <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Deal Name</label>
                    <input type="text" id="deal-name" class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" placeholder="e.g. Phoenix Portfolio">
                </div>
                <div class="col-span-2">
                    <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Address</label>
                    <input type="text" id="deal-address" class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" placeholder="123 Investment St.">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Purchase Price</label>
                    <input type="number" id="deal-price" class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Pipeline Stage</label>
                    <select id="deal-stage" class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none">
                        <option>Sourced</option>
                        <option>Underwriting</option>
                        <option>LOI Sent</option>
                        <option>Closing</option>
                    </select>
                </div>
                <div class="col-span-2"><hr class="my-2 border-gray-100"></div>
                <div>
                    <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Rehab Budget</label>
                    <input type="number" id="deal-rehab" class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" placeholder="0">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Closing Costs</label>
                    <input type="number" id="deal-closing_costs" class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" placeholder="0">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Total Units</label>
                    <input type="number" id="deal-units" class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Pro-Forma NOI (Annual)</label>
                    <input type="number" id="deal-proforma_noi" class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none">
                </div>
            </div>
        `;

        modalManager.show("Add New Opportunity", formHtml, () => {
            const data = {
                name: document.getElementById('deal-name').value,
                address: document.getElementById('deal-address').value,
                price: parseFloat(document.getElementById('deal-price').value) || 0,
                stage: document.getElementById('deal-stage').value,
                rehab: parseFloat(document.getElementById('deal-rehab').value) || 0,
                closing_costs: parseFloat(document.getElementById('deal-closing_costs').value) || 0,
                units: parseInt(document.getElementById('deal-units').value) || 0,
                proforma_noi: parseFloat(document.getElementById('deal-proforma_noi').value) || 0,
                createdAt: new Date().toISOString()
            };

            if (data.name) {
                stateManager.add('deals', data);
            }
        });
    },

    getStageClass(stage) {
        const s = stage?.toLowerCase() || '';
        if (s === 'closing') return 'bg-emerald-100 text-emerald-700';
        if (s === 'loi sent') return 'bg-blue-100 text-blue-700';
        if (s === 'underwriting') return 'bg-orange-100 text-orange-700';
        return 'bg-slate-100 text-slate-600';
    }
};

export const showAddContactModal = () => deals.showAddContactModal();