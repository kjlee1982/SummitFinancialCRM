/**
 * src/modules/properties.js
 * Manages the Stabilized Portfolio and Asset Management metrics.
 */

import { stateManager } from '../state.js';
import { formatters } from '../utils/formatters.js';
import { modalManager } from '../utils/modals.js';
import { calc } from '../utils/calculations.js';

export const properties = {
    /**
     * Main render function called by the router
     */
    render(state) {
        const container = document.getElementById('view-properties');
        if (!container) return;

        const propertyList = state.properties || [];

        // 1. Portfolio Calculations
        const totalValue = propertyList.reduce((sum, p) => sum + (parseFloat(p.valuation) || 0), 0);
        const totalUnits = propertyList.reduce((sum, p) => sum + (parseInt(p.units) || 0), 0);
        const avgOccupancy = propertyList.length 
            ? (propertyList.reduce((sum, p) => sum + (parseFloat(p.occupancy) || 0), 0) / propertyList.length).toFixed(1)
            : 0;
        const totalNOI = propertyList.reduce((sum, p) => sum + (parseFloat(p.actual_noi) || 0), 0);
        const portfolioCapRate = totalValue ? ((totalNOI / totalValue) * 100).toFixed(2) : 0;

        container.innerHTML = `
            <div class="p-6 max-w-7xl mx-auto">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h2 class="text-2xl font-black text-slate-900 tracking-tight italic">Asset Portfolio</h2>
                        <p class="text-sm text-slate-500 font-medium">
                            ${propertyList.length} Stabilized Assets • ${totalUnits} Total Doors • ${formatters.compact(totalValue)} AUM
                        </p>
                    </div>
                    <button id="add-property-btn" class="bg-slate-900 text-white px-5 py-2.5 rounded-xl hover:bg-slate-800 font-bold shadow-sm transition-all flex items-center text-sm">
                        <i class="fa fa-plus-circle mr-2 text-[10px]"></i>Add Asset
                    </button>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Portfolio Occupancy</p>
                        <p class="text-2xl font-black text-slate-900">${avgOccupancy}%</p>
                    </div>
                    <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Market Valuation</p>
                        <p class="text-2xl font-black text-slate-900">${formatters.compact(totalValue)}</p>
                    </div>
                    <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Blended Cap Rate</p>
                        <p class="text-2xl font-black text-orange-600">${portfolioCapRate}%</p>
                    </div>
                    <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Portfolio LTV</p>
                        <p class="text-2xl font-black text-slate-900">${this.calculatePortfolioLTV(propertyList)}%</p>
                    </div>
                </div>

                <div class="grid grid-cols-1 xl:grid-cols-2 gap-6" id="property-grid">
                    ${this.renderPropertyCards(propertyList)}
                </div>
            </div>
        `;

        this.bindEvents();
    },

    renderPropertyCards(propertyList) {
        if (propertyList.length === 0) {
            return `
                <div class="col-span-full py-24 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-white">
                    <div class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="fa fa-city text-slate-200 text-2xl"></i>
                    </div>
                    <p class="text-slate-400 font-bold uppercase tracking-widest text-xs">No assets under management</p>
                </div>`;
        }

        return propertyList.map(prop => {
            const ltv = calc.ltv(prop.loan_balance, prop.valuation);
            const capRate = prop.valuation ? ((prop.actual_noi / prop.valuation) * 100).toFixed(2) : 0;
            const occupancyColor = prop.occupancy < 90 ? 'text-red-500' : 'text-emerald-500';

            return `
                <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col sm:flex-row hover:border-slate-400 transition-all group">
                    <div class="w-full sm:w-48 bg-slate-50 flex flex-col items-center justify-center p-6 border-b sm:border-b-0 sm:border-r border-slate-100 relative overflow-hidden">
                        <div class="absolute inset-0 opacity-[0.03] pointer-events-none">
                            <i class="fa fa-map-marked-alt text-8xl -rotate-12 translate-x-4"></i>
                        </div>
                        <i class="fa fa-building text-4xl text-slate-200 mb-3 group-hover:text-orange-500 transition-colors"></i>
                        <span class="text-[10px] font-black text-slate-900 uppercase tracking-tighter bg-white px-3 py-1 rounded-full border border-slate-200 shadow-sm">
                            ${prop.units} UNITS
                        </span>
                    </div>

                    <div class="flex-grow p-6">
                        <div class="flex justify-between items-start mb-6">
                            <div>
                                <h3 class="font-black text-slate-900 text-xl tracking-tight">${prop.name}</h3>
                                <div class="flex items-center gap-2 mt-2">
                                    <span class="text-[9px] bg-slate-900 text-white px-2 py-0.5 rounded font-black uppercase tracking-widest">
                                        <i class="fa fa-shield-halved mr-1 text-orange-400"></i>${prop.owning_llc || 'Personal'}
                                    </span>
                                </div>
                            </div>
                            <button data-action="prop-delete" data-id="${prop.id}" class="text-slate-200 hover:text-red-500 transition-all">
                                <i class="fa fa-trash-alt text-sm"></i>
                            </button>
                        </div>

                        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-50">
                            <div>
                                <p class="text-[9px] text-slate-400 font-black uppercase mb-1 tracking-widest">Occupancy</p>
                                <p class="text-sm font-black ${occupancyColor}">${prop.occupancy}%</p>
                            </div>
                            <div>
                                <p class="text-[9px] text-slate-400 font-black uppercase mb-1 tracking-widest">Valuation</p>
                                <p class="text-sm font-black text-slate-900">${formatters.compact(prop.valuation)}</p>
                            </div>
                            <div>
                                <p class="text-[9px] text-slate-400 font-black uppercase mb-1 tracking-widest">Cap Rate</p>
                                <p class="text-sm font-black text-orange-600">${capRate}%</p>
                            </div>
                            <div>
                                <p class="text-[9px] text-slate-400 font-black uppercase mb-1 tracking-widest">LTV</p>
                                <p class="text-sm font-black text-slate-900">${ltv}%</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    bindEvents() {
        const addBtn = document.getElementById('add-property-btn');
        if (addBtn) addBtn.onclick = () => this.showAddPropertyModal();

        document.querySelectorAll('[data-action="prop-delete"]').forEach(btn => {
            btn.onclick = (e) => {
                const id = e.currentTarget.dataset.id;
                if (confirm("Remove asset from portfolio? This will not delete the associated LLC.")) {
                    stateManager.delete('properties', id);
                }
            };
        });
    },

    calculatePortfolioLTV(properties) {
        const totalValue = properties.reduce((sum, p) => sum + (parseFloat(p.valuation) || 0), 0);
        const totalDebt = properties.reduce((sum, p) => sum + (parseFloat(p.loan_balance) || 0), 0);
        return totalValue ? ((totalDebt / totalValue) * 100).toFixed(1) : 0;
    },

    showAddPropertyModal() {
        const state = stateManager.get();
        const llcOptions = (state.llcs || []).map(llc => 
            `<option value="${llc.name}">${llc.name}</option>`
        ).join('');

        const formHtml = `
            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                    <div class="col-span-2">
                        <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Property Legal Name</label>
                        <input type="text" id="prop-name" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 transition-all" placeholder="e.g. Blue Spruce Apartments">
                    </div>
                    <div class="col-span-2">
                        <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Titled Entity (LLC)</label>
                        <select id="prop-llc" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none">
                            <option value="">Select LLC...</option>
                            ${llcOptions}
                        </select>
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Current Valuation ($)</label>
                        <input type="number" id="prop-val" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="0">
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Loan Balance ($)</label>
                        <input type="number" id="prop-loan" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="0">
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Unit Count</label>
                        <input type="number" id="prop-units" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="0">
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Occupancy (%)</label>
                        <input type="number" id="prop-occ" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="95">
                    </div>
                    <div class="col-span-2">
                        <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Annual Net Operating Income (NOI)</label>
                        <input type="number" id="prop-noi" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="0">
                    </div>
                </div>
                <div class="p-4 bg-blue-50 rounded-xl border border-blue-100 flex gap-3">
                    <i class="fa fa-info-circle text-blue-400 mt-1"></i>
                    <p class="text-[10px] text-blue-700 leading-relaxed font-medium">
                        NOI should reflect income <b>after</b> all operating expenses but <b>before</b> debt service.
                    </p>
                </div>
            </div>
        `;

        modalManager.show("Add Stabilized Asset", formHtml, () => {
            const data = {
                name: document.getElementById('prop-name').value,
                owning_llc: document.getElementById('prop-llc').value,
                valuation: parseFloat(document.getElementById('prop-val').value) || 0,
                loan_balance: parseFloat(document.getElementById('prop-loan').value) || 0,
                units: parseInt(document.getElementById('prop-units').value) || 0,
                occupancy: parseFloat(document.getElementById('prop-occ').value) || 0,
                actual_noi: parseFloat(document.getElementById('prop-noi').value) || 0
            };

            if (data.name) {
                stateManager.add('properties', data);
            }
        });
    }
};