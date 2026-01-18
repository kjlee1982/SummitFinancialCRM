/**
 * src/modules/investorPortal.js
 * Personalized view for limited partners to track their specific investments.
 */
import { stateManager } from '../state.js';
import { formatters } from '../utils/formatters.js';

export const investorPortal = {
    render() {
        const container = document.getElementById('view-investor-portal');
        if (!container) return;

        const state = stateManager.get();
        
        // For this demo, we'll assume we are viewing the portal for the first investor in your list.
        // In a live environment, you would match this to the auth.currentUser.email.
        const activeInvestor = state.investors[0]; 

        if (!activeInvestor) {
            container.innerHTML = `<div class="p-20 text-center text-gray-400">No investor data found to generate portal.</div>`;
            return;
        }

        // Logic: Filter properties where this investor's name is mentioned in the notes or a dedicated "Partners" field
        const investments = state.properties.filter(p => 
            p.notes?.includes(activeInvestor.name) || p.owning_llc?.includes(activeInvestor.name)
        );

        const totalEquity = investments.reduce((sum, p) => sum + (parseFloat(p.valuation) * 0.1), 0); // Assuming 10% stake for demo

        container.innerHTML = `
            <div class="p-8 max-w-6xl mx-auto">
                <div class="bg-slate-900 rounded-3xl p-10 text-white mb-10 shadow-2xl relative overflow-hidden">
                    <div class="relative z-10">
                        <p class="text-orange-500 font-black text-xs uppercase tracking-widest mb-2">Investor Statement</p>
                        <h1 class="text-4xl font-black tracking-tight mb-2">Welcome back, ${activeInvestor.name.split(' ')[0]}</h1>
                        <p class="text-slate-400 font-medium">Reporting period: Q1 2026</p>
                    </div>
                    <i class="fa fa-chart-line absolute right-[-20px] bottom-[-20px] text-[200px] text-white/5 rotate-12"></i>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                    <div class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Equity Value</p>
                        <p class="text-2xl font-black text-slate-900">${formatters.dollars(totalEquity)}</p>
                    </div>
                    <div class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Active Investments</p>
                        <p class="text-2xl font-black text-slate-900">${investments.length} Assets</p>
                    </div>
                    <div class="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
                        <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Lifetime Distributions</p>
                        <p class="text-2xl font-black text-emerald-600">${formatters.dollars(totalEquity * 0.08)}</p>
                    </div>
                </div>

                <h2 class="text-xl font-black text-slate-900 mb-6 px-2">Your Portfolio</h2>
                
                <div class="grid grid-cols-1 gap-6">
                    ${this.renderInvestmentRows(investments)}
                </div>
            </div>
        `;
    },

    renderInvestmentRows(investments) {
        if (investments.length === 0) return `<div class="bg-white p-12 rounded-2xl border-2 border-dashed text-center text-gray-400">No active co-investments found for this account.</div>`;

        return investments.map(p => `
            <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col md:flex-row items-center justify-between hover:border-orange-200 transition-all group">
                <div class="flex items-center gap-4 w-full md:w-1/3">
                    <div class="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-orange-50 group-hover:text-orange-600 transition-colors">
                        <i class="fa fa-building"></i>
                    </div>
                    <div>
                        <h4 class="font-bold text-slate-900">${p.name}</h4>
                        <p class="text-xs text-gray-400 font-medium">${p.units} Units • Multi-family</p>
                    </div>
                </div>
                
                <div class="grid grid-cols-2 md:grid-cols-3 gap-8 w-full md:w-2/3 mt-6 md:mt-0 pt-6 md:pt-0 border-t md:border-t-0 border-gray-50">
                    <div>
                        <p class="text-[10px] font-black text-gray-400 uppercase">Current Valuation</p>
                        <p class="text-sm font-bold text-slate-900">${formatters.compact(p.valuation)}</p>
                    </div>
                    <div>
                        <p class="text-[10px] font-black text-gray-400 uppercase">Occupancy</p>
                        <p class="text-sm font-bold text-emerald-600">${p.occupancy}%</p>
                    </div>
                    <div class="hidden md:block text-right">
                        <button class="text-xs font-black text-slate-900 border border-slate-200 px-4 py-2 rounded-lg hover:bg-slate-50">
                            VIEW K-1
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }
};