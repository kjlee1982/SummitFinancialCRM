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
        
        // Match active investor (demo defaults to first investor in state)
        const activeInvestor = state.investors?.[0]; 

        if (!activeInvestor) {
            container.innerHTML = `
                <div class="p-20 text-center">
                    <div class="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                        <i class="fa fa-user-lock text-2xl"></i>
                    </div>
                    <p class="text-gray-500 font-bold">No investor profile found.</p>
                    <p class="text-gray-400 text-sm">Please ensure an investor is added to the CRM.</p>
                </div>`;
            return;
        }

        // Search logic: Look for investor name in property notes or LLC name
        const investments = state.properties.filter(p => 
            p.notes?.toLowerCase().includes(activeInvestor.name.toLowerCase()) || 
            p.owning_llc?.toLowerCase().includes(activeInvestor.name.toLowerCase())
        );

        // Financial Logic
        // For demo: assumed 10% equity stake if not specified
        const assumedStake = 0.10; 
        const totalPortfolioValue = investments.reduce((sum, p) => sum + (parseFloat(p.valuation) || 0), 0);
        const investorEquity = totalPortfolioValue * assumedStake;
        const projectedDistributions = investorEquity * 0.075; // Assumed 7.5% annual yield

        container.innerHTML = `
            <div class="p-8 max-w-6xl mx-auto space-y-10">
                <div class="bg-slate-900 rounded-[2rem] p-10 text-white shadow-2xl relative overflow-hidden border border-slate-800">
                    <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <div class="flex items-center gap-2 mb-4">
                                <span class="h-2 w-2 rounded-full bg-orange-500 animate-pulse"></span>
                                <p class="text-orange-500 font-black text-[10px] uppercase tracking-[0.2em]">Investor Secure Portal</p>
                            </div>
                            <h1 class="text-4xl md:text-5xl font-black tracking-tight mb-2">Welcome back, ${activeInvestor.name.split(' ')[0]}</h1>
                            <p class="text-slate-400 font-medium">Portfolio performance for the period ending <span class="text-white">${new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span></p>
                        </div>
                        <div class="bg-slate-800/50 backdrop-blur-md p-6 rounded-2xl border border-white/5">
                            <p class="text-[10px] font-black text-slate-400 uppercase mb-1">Account Standing</p>
                            <p class="text-emerald-400 font-bold flex items-center gap-2">
                                <i class="fa fa-check-circle"></i> VERIFIED ACCREDITED
                            </p>
                        </div>
                    </div>
                    <i class="fa fa-chart-line absolute right-[-20px] bottom-[-20px] text-[240px] text-white/[0.03] rotate-12 pointer-events-none"></i>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div class="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                        <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Estimated Equity Value</p>
                        <p class="text-3xl font-black text-slate-900">${formatters.dollars(investorEquity)}</p>
                        <div class="mt-4 flex items-center text-xs font-bold text-emerald-600 bg-emerald-50 w-fit px-2 py-1 rounded-full">
                            <i class="fa fa-arrow-up mr-1"></i> +4.2% YoY
                        </div>
                    </div>
                    <div class="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                        <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Assets Under Mgmt</p>
                        <p class="text-3xl font-black text-slate-900">${investments.length}</p>
                        <p class="mt-4 text-xs text-slate-400 font-medium">Primary Class: Multi-Family</p>
                    </div>
                    <div class="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                        <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Annual Distributions</p>
                        <p class="text-3xl font-black text-emerald-600">${formatters.dollars(projectedDistributions)}</p>
                        <div class="mt-4 flex items-center text-xs font-bold text-slate-500">
                             Est. Yield: 7.50%
                        </div>
                    </div>
                </div>

                <div class="space-y-6">
                    <div class="flex items-center justify-between px-2">
                        <h2 class="text-xl font-black text-slate-900">Portfolio Composition</h2>
                        <button class="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">Download Statement</button>
                    </div>
                    
                    <div class="grid grid-cols-1 gap-4">
                        ${this.renderInvestmentRows(investments, assumedStake)}
                    </div>
                </div>
            </div>
        `;
    },

    renderInvestmentRows(investments, stake) {
        if (investments.length === 0) {
            return `
                <div class="bg-slate-50 p-16 rounded-[2rem] border-2 border-dashed border-slate-200 text-center">
                    <p class="text-slate-400 font-bold">No active co-investments found.</p>
                    <p class="text-slate-400 text-sm">Please verify ownership notes in the Property Manager.</p>
                </div>`;
        }

        return investments.map(p => {
            const valuation = parseFloat(p.valuation) || 0;
            const investorShare = valuation * stake;

            return `
                <div class="bg-white rounded-[1.5rem] border border-gray-100 shadow-sm p-6 flex flex-col md:flex-row items-center justify-between hover:border-orange-300 hover:shadow-lg hover:shadow-orange-500/5 transition-all group">
                    <div class="flex items-center gap-6 w-full md:w-1/3">
                        <div class="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-slate-200 group-hover:bg-orange-500 transition-colors">
                            <i class="fa fa-building text-xl"></i>
                        </div>
                        <div class="min-w-0">
                            <h4 class="font-bold text-slate-900 text-lg truncate">${p.name}</h4>
                            <p class="text-xs text-slate-400 font-bold uppercase tracking-tighter">${p.units} Units • ${p.occupancy}% Occupancy</p>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-10 w-full md:w-2/3 mt-8 md:mt-0 pt-8 md:pt-0 border-t md:border-t-0 border-slate-50">
                        <div>
                            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Equity Interest</p>
                            <p class="text-sm font-black text-slate-900">${(stake * 100).toFixed(1)}% Ownership</p>
                        </div>
                        <div>
                            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Equity Value</p>
                            <p class="text-sm font-black text-emerald-600">${formatters.dollars(investorShare)}</p>
                        </div>
                        <div class="flex justify-end items-center">
                            <button class="bg-slate-50 text-slate-900 text-[10px] font-black px-6 py-3 rounded-xl hover:bg-slate-900 hover:text-white transition-all">
                                VIEW K-1
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
};