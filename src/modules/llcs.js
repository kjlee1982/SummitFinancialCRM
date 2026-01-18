/**
 * src/modules/llcs.js
 * Manages Legal Entities, LLC structures, and ownership mapping.
 */

import { stateManager } from '../state.js';
import { formatters } from '../utils/formatters.js';
import { modalManager } from '../utils/modals.js';

export const llcs = {
    /**
     * Main render function called by the router
     */
    render(state) {
        const container = document.getElementById('view-llcs');
        if (!container) return;

        const entities = state.llcs || [];

        container.innerHTML = `
            <div class="p-6">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h2 class="text-2xl font-black text-slate-900">Legal Entities</h2>
                        <p class="text-sm text-slate-500 font-medium">
                            Managing ${entities.length} Special Purpose Vehicles (SPVs) for asset titling.
                        </p>
                    </div>
                    <button id="add-llc-btn" class="bg-slate-900 text-white px-5 py-2.5 rounded-lg hover:bg-slate-800 font-bold shadow-sm transition-all flex items-center text-sm">
                        <i class="fa fa-file-shield mr-2 text-[10px]"></i>Register New LLC
                    </button>
                </div>

                <div class="grid grid-cols-1 xl:grid-cols-2 gap-6" id="llc-grid">
                    ${this.renderLLCCards(entities, state.properties || [])}
                </div>
            </div>
        `;

        this.bindEvents();
    },

    renderLLCCards(entitiesList, allProperties) {
        if (entitiesList.length === 0) {
            return `
                <div class="col-span-full py-20 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-white">
                    <i class="fa fa-folder-open text-4xl mb-4 opacity-20"></i>
                    <p class="font-bold">No legal entities registered.</p>
                    <p class="text-sm">SPVs are required to hold title for real estate assets.</p>
                </div>`;
        }

        return entitiesList.map(llc => {
            // Filter properties where this LLC is the owner
            const ownedProperties = allProperties.filter(p => 
                p.owning_llc === llc.name || p.llc_id === llc.id
            );
            
            return `
                <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:border-slate-400 transition-all group">
                    <div class="p-5 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
                        <div>
                            <h3 class="font-black text-slate-900 uppercase tracking-tight">${llc.name}</h3>
                            <div class="flex items-center gap-3 mt-1">
                                <p class="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                    EIN: <span class="text-slate-900">${llc.ein || 'PENDING'}</span>
                                </p>
                                <span class="text-slate-300">|</span>
                                <p class="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                                    Jurisdiction: <span class="text-slate-900">${llc.state_of_inc || 'DE'}</span>
                                </p>
                            </div>
                        </div>
                        <div class="flex flex-col items-end gap-2">
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center">
                                <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
                                GOOD STANDING
                            </span>
                            <button data-action="llc-delete" data-id="${llc.id}" class="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all">
                                <i class="fa fa-trash-alt text-[10px]"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div class="p-5">
                        <h4 class="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-[0.15em]">Titled Portfolio Assets</h4>
                        <div class="space-y-2">
                            ${ownedProperties.length > 0 ? ownedProperties.map(p => `
                                <div class="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-sm transition-all cursor-default">
                                    <div class="flex items-center text-xs font-bold text-slate-700">
                                        <div class="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center mr-3 text-[10px]">
                                            <i class="fa fa-building text-slate-400"></i>
                                        </div>
                                        ${p.name}
                                    </div>
                                    <span class="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-black uppercase tracking-tighter">${p.units} UNITS</span>
                                </div>
                            `).join('') : `
                                <div class="py-6 text-center border border-dashed border-slate-100 rounded-xl">
                                    <p class="text-[10px] text-slate-400 font-bold uppercase italic">No assets currently titled to this entity</p>
                                </div>
                            `}
                        </div>
                    </div>

                    <div class="px-5 py-4 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div class="text-[11px] text-slate-500">
                            Manager: <span class="font-black text-slate-900 uppercase">${llc.manager || 'Corporate GP'}</span>
                        </div>
                        <div class="flex gap-3">
                            <button class="flex items-center text-[10px] font-black text-slate-600 uppercase bg-white border border-slate-200 px-3 py-1.5 rounded-lg hover:border-orange-500 hover:text-orange-600 transition-all shadow-sm">
                                <i class="fa fa-file-contract mr-2"></i> Documents
                            </button>
                            <button class="flex items-center text-[10px] font-black text-slate-600 uppercase bg-white border border-slate-200 px-3 py-1.5 rounded-lg hover:border-orange-500 hover:text-orange-600 transition-all shadow-sm">
                                <i class="fa fa-fingerprint mr-2"></i> Tax ID
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    bindEvents() {
        const addBtn = document.getElementById('add-llc-btn');
        if (addBtn) addBtn.onclick = () => this.showAddLLCModal();

        // Delete Logic
        document.querySelectorAll('[data-action="llc-delete"]').forEach(btn => {
            btn.onclick = (e) => {
                const id = e.currentTarget.dataset.id;
                if (confirm("De-register this entity? Warning: Ensure no assets are titled to this LLC before proceeding.")) {
                    stateManager.delete('llcs', id);
                }
            };
        });
    },

    showAddLLCModal() {
        const formHtml = `
            <div class="space-y-5">
                <div>
                    <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Entity Full Legal Name</label>
                    <input type="text" id="llc-name" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 transition-all" placeholder="e.g. 123 Main St Holdings, LLC">
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">State of Org.</label>
                        <select id="llc-state" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none">
                            <option value="DE">Delaware</option>
                            <option value="TX">Texas</option>
                            <option value="FL">Florida</option>
                            <option value="WY">Wyoming</option>
                            <option value="NV">Nevada</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">EIN / Tax ID</label>
                        <input type="text" id="llc-ein" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="00-0000000">
                    </div>
                </div>
                <div>
                    <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Designated Managing Member</label>
                    <input type="text" id="llc-manager" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="e.g. Summit Capital Management, LLC">
                </div>
                <div class="p-4 bg-orange-50 rounded-xl border border-orange-100">
                    <p class="text-[10px] text-orange-700 font-bold leading-relaxed italic">
                        <i class="fa fa-info-circle mr-1"></i> Ensure the legal name exactly matches the Articles of Organization filed with the Secretary of State.
                    </p>
                </div>
            </div>
        `;

        modalManager.show("Register Legal Entity", formHtml, () => {
            const data = {
                name: document.getElementById('llc-name').value,
                state_of_inc: document.getElementById('llc-state').value,
                ein: document.getElementById('llc-ein').value,
                manager: document.getElementById('llc-manager').value,
                registeredAt: new Date().toISOString()
            };

            if (data.name) {
                stateManager.add('llcs', data);
            }
        });
    }
};