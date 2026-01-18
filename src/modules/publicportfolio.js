/**
 * src/modules/publicPortfolio.js
 * A sanitized, high-end view of the portfolio for external stakeholders.
 */
import { stateManager } from '../state.js';
import { formatters } from '../utils/formatters.js';

export const publicPortfolio = {
    /**
     * Renders the Public Track Record View
     */
    render() {
        const container = document.getElementById('view-public-portfolio');
        if (!container) return;

        const state = stateManager.get();
        const properties = state.properties || [];
        
        // Calculate Public Stats (Sanitized & Aggregated)
        const totalUnits = properties.reduce((sum, p) => sum + (parseInt(p.units) || 0), 0);
        const portfolioValue = properties.reduce((sum, p) => sum + (parseFloat(p.valuation) || 0), 0);
        const avgOcc = properties.length 
            ? (properties.reduce((sum, p) => sum + (parseFloat(p.occupancy) || 0), 0) / properties.length).toFixed(1)
            : 0;

        container.innerHTML = `
            <div class="p-8 max-w-7xl mx-auto space-y-12">
                <div class="flex flex-col md:flex-row justify-between items-start md:items-end border-b-4 border-slate-900 pb-10 gap-6">
                    <div class="space-y-2">
                        <div class="flex items-center gap-3 text-orange-600 font-black uppercase tracking-[0.3em] text-xs">
                            <span class="w-8 h-[2px] bg-orange-600"></span>
                            Investor Relations
                        </div>
                        <h1 class="text-5xl md:text-6xl font-black text-slate-900 tracking-tighter leading-none">
                            PORTFOLIO <br><span class="text-slate-300">SNAPSHOT</span>
                        </h1>
                        <p class="text-lg text-slate-500 font-medium max-w-md italic">
                            A curated look at the current holdings and operational performance of ${state.settings?.companyName || 'Summit Capital'}.
                        </p>
                    </div>
                    
                    <div class="flex flex-col items-end gap-4 w-full md:w-auto">
                        <button id="share-portfolio" class="w-full md:w-auto flex items-center justify-center gap-3 bg-slate-900 text-white px-8 py-4 rounded-full font-bold text-sm hover:bg-orange-600 transition-all duration-300 shadow-2xl shadow-slate-200">
                            <i class="fa fa-share-nodes"></i> GENERATE PORTFOLIO LINK
                        </button>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <div class="lg:col-span-1 bg-slate-900 rounded-3xl p-8 text-white flex flex-col justify-between">
                        <div>
                            <h4 class="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500 mb-6">Aggregate Scale</h4>
                            <div class="space-y-8">
                                <div>
                                    <p class="text-4xl font-black">${properties.length}</p>
                                    <p class="text-xs font-bold text-slate-400 uppercase tracking-widest">Core Assets</p>
                                </div>
                                <div>
                                    <p class="text-4xl font-black">${totalUnits}</p>
                                    <p class="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Doors</p>
                                </div>
                                <div>
                                    <p class="text-4xl font-black">${formatters.compact(portfolioValue)}</p>
                                    <p class="text-xs font-bold text-slate-400 uppercase tracking-widest">Assets Under Mgmt</p>
                                </div>
                            </div>
                        </div>
                        <div class="pt-8 mt-8 border-t border-slate-800">
                            <div class="flex justify-between items-center text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
                                <span>Portfolio Health</span>
                                <span class="text-emerald-400">${avgOcc}%</span>
                            </div>
                            <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                <div class="bg-emerald-400 h-full" style="width: ${avgOcc}%"></div>
                            </div>
                        </div>
                    </div>

                    <div class="lg:col-span-3">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                            ${this.renderPublicCards(properties)}
                        </div>
                    </div>
                </div>

                <div class="bg-slate-50 rounded-[3rem] p-12 text-center border border-slate-100">
                    <h3 class="text-slate-900 font-black text-2xl mb-4 italic uppercase tracking-tighter">Institutional Discipline. Entrepreneurial Agility.</h3>
                    <p class="text-slate-500 max-w-2xl mx-auto text-sm leading-relaxed">
                        Our investment philosophy focuses on recession-resilient assets in high-growth submarkets. We prioritize long-term capital preservation and consistent cash-on-cash returns.
                    </p>
                </div>

                <footer class="py-12 flex flex-col md:flex-row justify-between items-center gap-6 border-t border-slate-100">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-white font-black text-xl italic">
                            S
                        </div>
                        <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                            Summit Capital<br>Real Estate Partners
                        </span>
                    </div>
                    <p class="text-[10px] font-black text-slate-300 uppercase tracking-widest">
                        Confidential Portfolio Summary • Updated ${new Date().toLocaleDateString()}
                    </p>
                </footer>
            </div>
        `;

        this.initListeners();
    },

    renderPublicCards(properties) {
        if (properties.length === 0) {
            return `
                <div class="col-span-full py-32 text-center bg-white border-2 border-dashed border-slate-200 rounded-[2rem]">
                    <i class="fa fa-folder-open text-slate-200 text-5xl mb-4"></i>
                    <p class="text-slate-400 font-bold uppercase tracking-widest text-xs">No assets available for public viewing</p>
                </div>`;
        }

        return properties.map(p => `
            <div class="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden group hover:shadow-2xl hover:-translate-y-1 transition-all duration-500">
                <div class="h-56 bg-slate-200 flex items-center justify-center relative overflow-hidden">
                    <div class="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent z-10"></div>
                    <i class="fa fa-building text-7xl text-white/20 group-hover:scale-110 transition-transform duration-1000"></i>
                    
                    <div class="absolute bottom-6 left-6 z-20 text-white">
                        <span class="text-[10px] font-black uppercase tracking-widest bg-orange-600 px-3 py-1 rounded-full mb-2 inline-block shadow-lg">
                            ${p.units} Doors
                        </span>
                        <h3 class="text-2xl font-black leading-tight">${p.name}</h3>
                    </div>
                </div>
                
                <div class="p-8">
                    <div class="flex justify-between items-center mb-6">
                        <div class="flex flex-col">
                            <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset Class</span>
                            <span class="text-sm font-bold text-slate-900">Residential Multifamily</span>
                        </div>
                        <div class="text-right">
                            <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Market Value</span>
                            <span class="text-sm font-black text-slate-900 tracking-tight">${formatters.compact(p.valuation)}</span>
                        </div>
                    </div>

                    <div class="flex items-center justify-between py-4 border-t border-slate-50">
                        <span class="text-[11px] font-bold text-slate-400">Current Occupancy</span>
                        <div class="flex items-center gap-3">
                            <span class="text-xs font-black text-emerald-600">${p.occupancy}%</span>
                            <div class="w-12 h-1 bg-slate-100 rounded-full overflow-hidden">
                                <div class="bg-emerald-500 h-full" style="width: ${p.occupancy}%"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    },

    initListeners() {
        const shareBtn = document.getElementById('share-portfolio');
        if (shareBtn) {
            shareBtn.onclick = () => {
                const url = window.location.href;
                navigator.clipboard.writeText(url);
                const originalContent = shareBtn.innerHTML;
                shareBtn.innerHTML = `<i class="fa fa-check"></i> LINK SECURED TO CLIPBOARD`;
                shareBtn.classList.replace('bg-slate-900', 'bg-emerald-600');
                
                setTimeout(() => {
                    shareBtn.innerHTML = originalContent;
                    shareBtn.classList.replace('bg-emerald-600', 'bg-slate-900');
                }, 3000);
            };
        }
    }
};