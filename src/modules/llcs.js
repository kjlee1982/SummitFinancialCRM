/**
 * src/modules/llcs.js
 * Manages Legal Entities, LLC structures, and ownership mapping.
 */

import { stateManager } from '../state.js';
import { formatters } from '../utils/formatters.js';
import { modalManager } from '../utils/modals.js';

export function renderLLCs(entities) {
    const container = document.getElementById('view-llcs');
    if (!container) return;

    container.innerHTML = `
        <div class="p-6">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 class="text-2xl font-bold text-gray-900">Legal Entities</h2>
                    <p class="text-sm text-gray-500 font-medium">
                        Managing ${entities.length} Special Purpose Vehicles (SPVs)
                    </p>
                </div>
                <button data-action="llc-add" class="bg-slate-900 text-white px-5 py-2.5 rounded-lg hover:bg-slate-800 font-bold shadow-sm transition-all flex items-center text-sm">
                    <i class="fa fa-file-shield mr-2"></i>Register New LLC
                </button>
            </div>

            <div class="grid grid-cols-1 xl:grid-cols-2 gap-6" id="llc-grid">
                ${renderLLCCards(entities)}
            </div>
        </div>
    `;
}

function renderLLCCards(entitiesList) {
    if (entitiesList.length === 0) {
        return `<div class="col-span-full py-20 text-center text-gray-400 border-2 border-dashed rounded-xl bg-white">
            <p>No legal entities registered. SPVs are required for asset titling.</p>
        </div>`;
    }

    const allProperties = stateManager.get().properties;

    return entitiesList.map(llc => {
        // Find properties where the owning_llc matches this LLC name or ID
        const ownedProperties = allProperties.filter(p => p.owning_llc === llc.name);
        
        return `
            <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:border-slate-300 transition-all">
                <div class="p-5 border-b border-gray-100 flex justify-between items-start bg-slate-50/30">
                    <div>
                        <h3 class="font-bold text-slate-900 uppercase tracking-tight">${llc.name}</h3>
                        <p class="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                            EIN: ${llc.ein || 'PENDING'} • State: ${llc.state_of_inc || 'DE'}
                        </p>
                    </div>
                    <div class="flex flex-col items-end gap-2">
                        <span class="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100">
                            GOOD STANDING
                        </span>
                        <button data-action="llc-delete" data-id="${llc.id}" class="text-gray-300 hover:text-red-500 transition-colors">
                            <i class="fa fa-trash-alt text-[10px]"></i>
                        </button>
                    </div>
                </div>
                
                <div class="p-5">
                    <h4 class="text-[10px] font-black text-gray-400 uppercase mb-3 tracking-widest">Titled Assets</h4>
                    <div class="space-y-2">
                        ${ownedProperties.length > 0 ? ownedProperties.map(p => `
                            <div class="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                                <div class="flex items-center text-xs font-bold text-slate-700">
                                    <i class="fa fa-building text-slate-400 mr-2"></i>
                                    ${p.name}
                                </div>
                                <span class="text-[10px] text-slate-400 font-medium">${p.units} Units</span>
                            </div>
                        `).join('') : `
                            <div class="py-4 text-center border border-dashed rounded-lg">
                                <p class="text-[10px] text-gray-400 font-bold uppercase">No assets currently titled</p>
                            </div>
                        `}
                    </div>
                </div>

                <div class="px-5 py-4 bg-gray-50/50 border-t border-gray-100 flex justify-between items-center">
                    <div class="text-[11px] text-gray-500">
                        Managing Member: <span class="font-bold text-slate-900">${llc.manager || 'Corporate Entity'}</span>
                    </div>
                    <div class="flex gap-4">
                        <button class="text-[11px] font-black text-orange-600 uppercase hover:underline">Documents</button>
                        <button class="text-[11px] font-black text-orange-600 uppercase hover:underline">Tax ID</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Modal to Register a New Legal Entity
 */
export function showAddLLCModal() {
    const formHtml = `
        <div class="space-y-4">
            <div>
                <label class="block text-xs font-black text-gray-400 uppercase mb-1">Entity Name (Full Legal Name)</label>
                <input type="text" id="name" class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-slate-900 outline-none" placeholder="e.g. 123 Main St Holdings, LLC">
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-xs font-black text-gray-400 uppercase mb-1">State of Incorporation</label>
                    <select id="state_of_inc" class="w-full p-3 border rounded-lg outline-none">
                        <option value="DE">Delaware</option>
                        <option value="TX">Texas</option>
                        <option value="FL">Florida</option>
                        <option value="WY">Wyoming</option>
                        <option value="NV">Nevada</option>
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-black text-gray-400 uppercase mb-1">EIN / Tax ID</label>
                    <input type="text" id="ein" class="w-full p-3 border rounded-lg outline-none" placeholder="00-0000000">
                </div>
            </div>
            <div>
                <label class="block text-xs font-black text-gray-400 uppercase mb-1">Managing Member / Manager</label>
                <input type="text" id="manager" class="w-full p-3 border rounded-lg outline-none" placeholder="e.g. Summit Capital Management, LLC">
            </div>
        </div>
    `;

    modalManager.show("Register Legal Entity", formHtml, (data) => {
        stateManager.add('llcs', data);
    });
}