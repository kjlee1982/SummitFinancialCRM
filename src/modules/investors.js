/**
 * src/modules/investors.js
 * Manages Investor relationships, capital tracking, and commitment status.
 */

import { stateManager } from '../state.js';
import { formatters } from '../utils/formatters.js';
import { modalManager } from '../utils/modals.js';

export function renderInvestors(investors) {
    const container = document.getElementById('view-investors');
    if (!container) return;

    // 1. Calculate Relationship Stats
    const totalEquity = investors.reduce((sum, inv) => sum + (parseFloat(inv.total_invested) || 0), 0);
    const activeInvestors = investors.filter(inv => inv.status === 'Active').length;

    container.innerHTML = `
        <div class="p-6">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 class="text-2xl font-bold text-gray-900">Investor Relations</h2>
                    <p class="text-sm text-gray-500 font-medium">
                        ${investors.length} Total Profiles • ${activeInvestors} Active Partners • ${formatters.compact(totalEquity)} Total Deployed
                    </p>
                </div>
                <button data-action="investor-add" class="bg-slate-900 text-white px-5 py-2.5 rounded-lg hover:bg-slate-800 font-bold shadow-sm transition-all flex items-center text-sm">
                    <i class="fa fa-user-plus mr-2"></i>New Investor
                </button>
            </div>

            <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="bg-gray-50 border-b border-gray-100">
                            <th class="p-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Investor Name</th>
                            <th class="p-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                            <th class="p-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Total Invested</th>
                            <th class="p-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Investment Type</th>
                            <th class="p-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-50">
                        ${renderInvestorRows(investors)}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderInvestorRows(investors) {
    if (investors.length === 0) {
        return `<tr><td colspan="5" class="p-12 text-center text-gray-400">No investor profiles found.</td></tr>`;
    }

    return investors.map(inv => {
        const statusClass = getStatusClass(inv.status);
        
        return `
            <tr class="hover:bg-gray-50/50 transition-colors group">
                <td class="p-4">
                    <div class="flex items-center">
                        <div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold mr-3">
                            ${inv.name.charAt(0)}
                        </div>
                        <div>
                            <div class="font-bold text-gray-900">${inv.name}</div>
                            <div class="text-xs text-gray-500">${inv.email || 'No email set'}</div>
                        </div>
                    </div>
                </td>
                <td class="p-4">
                    <span class="px-2 py-1 rounded-full text-[10px] font-bold uppercase ${statusClass}">
                        ${inv.status || 'Prospect'}
                    </span>
                </td>
                <td class="p-4">
                    <div class="text-sm font-bold text-gray-900">${formatters.dollars(inv.total_invested)}</div>
                    <div class="text-[10px] text-gray-400 uppercase font-bold">${inv.deal_count || 0} Deals</div>
                </td>
                <td class="p-4">
                    <span class="text-sm text-gray-600">${inv.type || 'Individual'}</span>
                </td>
                <td class="p-4 text-right">
                    <div class="flex justify-end gap-2">
                        <button data-action="investor-edit" data-id="${inv.id}" class="p-2 text-gray-400 hover:text-slate-900 transition-colors">
                            <i class="fa fa-envelope"></i>
                        </button>
                        <button data-action="investor-delete" data-id="${inv.id}" class="p-2 text-gray-400 hover:text-red-500 transition-colors">
                            <i class="fa fa-trash-alt"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Modal to add a New Investor
 */
export function showAddInvestorModal() {
    const formHtml = `
        <div class="grid grid-cols-2 gap-4">
            <div class="col-span-2">
                <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Full Name / Entity Name</label>
                <input type="text" id="name" class="w-full p-3 border rounded-lg" placeholder="e.g. John Doe or Acme Family Office">
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Email Address</label>
                <input type="email" id="email" class="w-full p-3 border rounded-lg">
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Investor Status</label>
                <select id="status" class="w-full p-3 border rounded-lg text-sm">
                    <option value="Prospect">Prospect</option>
                    <option value="Qualified">Qualified</option>
                    <option value="Active">Active (Invested)</option>
                    <option value="Dormant">Dormant</option>
                </select>
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Investor Type</label>
                <select id="type" class="w-full p-3 border rounded-lg text-sm">
                    <option>Individual (Accredited)</option>
                    <option>Individual (Non-Accredited)</option>
                    <option>Family Office</option>
                    <option>Trust / LLC</option>
                    <option>Institutional</option>
                </select>
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Initial/Total Investment</label>
                <input type="number" id="total_invested" class="w-full p-3 border rounded-lg" placeholder="0">
            </div>
        </div>
    `;

    modalManager.show("New Investor Profile", formHtml, (data) => {
        stateManager.add('investors', data);
    });
}

function getStatusClass(status) {
    switch (status) {
        case 'Active': return 'bg-green-100 text-green-700';
        case 'Qualified': return 'bg-blue-100 text-blue-700';
        case 'Prospect': return 'bg-amber-100 text-amber-700';
        default: return 'bg-gray-100 text-gray-600';
    }
}