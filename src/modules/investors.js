/**
 * src/modules/investors.js
 * Manages Investor relationships, capital tracking, and commitment status.
 */

import { stateManager } from '../state.js';
import { formatters } from '../utils/formatters.js';
import { modalManager } from '../utils/modals.js';

export const investors = {
    /**
     * Main render function called by the router
     */
    render(state) {
        const container = document.getElementById('view-investors');
        if (!container) return;

        const investorList = state.investors || [];
        
        // 1. Calculate Relationship Stats
        const totalEquity = investorList.reduce((sum, inv) => sum + (parseFloat(inv.total_invested) || 0), 0);
        const activeCount = investorList.filter(inv => inv.status === 'Active').length;

        container.innerHTML = `
            <div class="p-6">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h2 class="text-2xl font-black text-slate-900">Investor Relations</h2>
                        <p class="text-sm text-slate-500 font-medium">
                            ${investorList.length} Partners • ${activeCount} Active • ${formatters.compact(totalEquity)} Total Deployed
                        </p>
                    </div>
                    <button id="add-investor-btn" class="bg-slate-900 text-white px-5 py-2.5 rounded-lg hover:bg-slate-800 font-bold shadow-sm transition-all flex items-center text-sm">
                        <i class="fa fa-user-plus mr-2 text-[10px]"></i>New Investor
                    </button>
                </div>

                <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <table class="w-full text-left border-collapse">
                        <thead>
                            <tr class="bg-slate-50/50 border-b border-slate-100">
                                <th class="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Partner Profile</th>
                                <th class="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Standing</th>
                                <th class="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Capital Contribution</th>
                                <th class="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Classification</th>
                                <th class="p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-50">
                            ${this.renderInvestorRows(investorList)}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        this.bindEvents();
    },

    renderInvestorRows(investorList) {
        if (investorList.length === 0) {
            return `<tr><td colspan="5" class="p-20 text-center text-slate-400 font-medium">No investor profiles found. Click "New Investor" to begin.</td></tr>`;
        }

        return investorList.map(inv => {
            const statusClass = this.getStatusClass(inv.status);
            
            return `
                <tr class="hover:bg-slate-50/50 transition-colors group">
                    <td class="p-4">
                        <div class="flex items-center">
                            <div class="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white font-black text-xs mr-3 shadow-lg shadow-slate-200">
                                ${inv.name.charAt(0)}
                            </div>
                            <div>
                                <div class="font-bold text-slate-900 leading-tight">${inv.name}</div>
                                <div class="text-[11px] text-slate-400 font-medium">${inv.email || 'No email set'}</div>
                            </div>
                        </div>
                    </td>
                    <td class="p-4">
                        <span class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${statusClass}">
                            ${inv.status || 'Prospect'}
                        </span>
                    </td>
                    <td class="p-4">
                        <div class="text-sm font-black text-slate-900">${formatters.dollars(inv.total_invested)}</div>
                        <div class="text-[10px] text-slate-400 uppercase font-bold tracking-widest">${inv.deal_count || 0} Assets</div>
                    </td>
                    <td class="p-4">
                        <span class="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-md">${inv.type || 'Individual'}</span>
                    </td>
                    <td class="p-4 text-right">
                        <div class="flex justify-end gap-2">
                            <button data-action="investor-portal-mock" data-id="${inv.id}" title="View Portal" class="p-2 text-slate-300 hover:text-orange-500 transition-colors">
                                <i class="fa fa-external-link-alt text-xs"></i>
                            </button>
                            <button data-action="investor-delete" data-id="${inv.id}" title="Delete Profile" class="p-2 text-slate-300 hover:text-red-500 transition-colors">
                                <i class="fa fa-trash-alt text-xs"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    },

    bindEvents() {
        const addBtn = document.getElementById('add-investor-btn');
        if (addBtn) addBtn.onclick = () => this.showAddInvestorModal();

        // Delete Handler
        document.querySelectorAll('[data-action="investor-delete"]').forEach(btn => {
            btn.onclick = (e) => {
                const id = e.currentTarget.dataset.id;
                if (confirm("Delete this investor profile? This action cannot be undone.")) {
                    stateManager.delete('investors', id);
                }
            };
        });

        // Portal Mock Link (Updates route to portal for this user)
        document.querySelectorAll('[data-action="investor-portal-mock"]').forEach(btn => {
            btn.onclick = () => {
                window.location.hash = '#investor-portal';
            };
        });
    },

    showAddInvestorModal() {
        const formHtml = `
            <div class="grid grid-cols-2 gap-5">
                <div class="col-span-2">
                    <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Legal Name / Entity</label>
                    <input type="text" id="inv-name" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 transition-all" placeholder="e.g. John Doe or Acme Family Office">
                </div>
                <div class="col-span-2 md:col-span-1">
                    <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Primary Email</label>
                    <input type="email" id="inv-email" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="investor@example.com">
                </div>
                <div class="col-span-2 md:col-span-1">
                    <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Partner Status</label>
                    <select id="inv-status" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none cursor-pointer">
                        <option value="Prospect">Prospect</option>
                        <option value="Qualified">Qualified</option>
                        <option value="Active">Active (Invested)</option>
                        <option value="Dormant">Dormant</option>
                    </select>
                </div>
                <div class="col-span-2 md:col-span-1">
                    <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Investor Type</label>
                    <select id="inv-type" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none cursor-pointer">
                        <option>Individual (Accredited)</option>
                        <option>Individual (Non-Accredited)</option>
                        <option>Family Office</option>
                        <option>Trust / LLC</option>
                        <option>Institutional</option>
                    </select>
                </div>
                <div class="col-span-2 md:col-span-1">
                    <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Deployed ($)</label>
                    <input type="number" id="inv-total_invested" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="0">
                </div>
            </div>
        `;

        modalManager.show("Create Investor Profile", formHtml, () => {
            const data = {
                name: document.getElementById('inv-name').value,
                email: document.getElementById('inv-email').value,
                status: document.getElementById('inv-status').value,
                type: document.getElementById('inv-type').value,
                total_invested: parseFloat(document.getElementById('inv-total_invested').value) || 0,
                deal_count: parseFloat(document.getElementById('inv-total_invested').value) > 0 ? 1 : 0,
                createdAt: new Date().toISOString()
            };

            if (data.name) {
                stateManager.add('investors', data);
            }
        });
    },

    getStatusClass(status) {
        switch (status) {
            case 'Active': return 'bg-emerald-50 text-emerald-600 border border-emerald-100';
            case 'Qualified': return 'bg-blue-50 text-blue-600 border border-blue-100';
            case 'Prospect': return 'bg-amber-50 text-amber-600 border border-amber-100';
            default: return 'bg-slate-50 text-slate-600 border border-slate-100';
        }
    }
};