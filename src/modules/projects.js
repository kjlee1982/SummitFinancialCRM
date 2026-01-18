/**
 * src/modules/projects.js
 * Tracks Capital Expenditures (CapEx) and Value-Add Renovations.
 */

import { stateManager } from '../state.js';
import { formatters } from '../utils/formatters.js';
import { modalManager } from '../utils/modals.js';

export const projects = {
    /**
     * Main render function called by the router
     */
    render(state) {
        const container = document.getElementById('view-projects');
        if (!container) return;

        const projectList = state.projects || [];
        
        // 1. Calculate Summary Stats
        const totalBudget = projectList.reduce((sum, p) => sum + (parseFloat(p.budget) || 0), 0);
        const totalSpent = projectList.reduce((sum, p) => sum + (parseFloat(p.spent) || 0), 0);
        const activeCount = projectList.filter(p => p.status !== 'Completed').length;
        const aggregateVariance = totalBudget - totalSpent;

        container.innerHTML = `
            <div class="p-6 max-w-7xl mx-auto">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h2 class="text-2xl font-black text-slate-900 tracking-tight">CapEx & Value-Add</h2>
                        <p class="text-sm text-slate-500 font-medium">
                            ${activeCount} Active Initiatives • Total Pipeline: ${formatters.compact(totalBudget)}
                        </p>
                    </div>
                    <button id="add-project-btn" class="bg-slate-900 text-white px-5 py-2.5 rounded-xl hover:bg-slate-800 font-bold shadow-sm transition-all flex items-center text-sm">
                        <i class="fa fa-tools mr-2 text-[10px]"></i>New Project
                    </button>
                </div>

                <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8">
                    <div class="flex justify-between items-end mb-3">
                        <div>
                            <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Portfolio Allocation</span>
                            <span class="text-xl font-black text-slate-900">${formatters.dollars(totalSpent)} <span class="text-slate-300 font-medium text-sm">deployed of</span> ${formatters.dollars(totalBudget)}</span>
                        </div>
                        <div class="text-right">
                            <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Remaining Buffer</span>
                            <span class="text-sm font-bold ${aggregateVariance < 0 ? 'text-red-500' : 'text-emerald-600'}">
                                ${formatters.dollars(aggregateVariance)}
                            </span>
                        </div>
                    </div>
                    <div class="w-full bg-slate-100 h-3 rounded-full overflow-hidden flex">
                        <div class="bg-orange-500 h-full transition-all duration-1000 ease-out" style="width: ${(totalSpent / totalBudget) * 100 || 0}%"></div>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${this.renderProjectCards(projectList)}
                </div>
            </div>
        `;

        this.bindEvents();
    },

    renderProjectCards(projectList) {
        if (projectList.length === 0) {
            return `
                <div class="col-span-full py-20 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-white">
                    <i class="fa fa-hard-hat text-4xl mb-4 opacity-20"></i>
                    <p class="font-bold uppercase tracking-widest text-xs">No active CapEx projects found</p>
                </div>`;
        }

        return projectList.map(proj => {
            const percentComplete = proj.status === 'Completed' ? 100 : (proj.percent_complete || 0);
            const variance = proj.budget - proj.spent;
            const statusClass = this.getStatusClass(proj.status);
            
            return `
                <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden hover:shadow-xl hover:border-slate-300 transition-all group">
                    <div class="p-5">
                        <div class="flex justify-between items-start mb-4">
                            <div>
                                <span class="text-[9px] font-black text-orange-600 uppercase bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-md tracking-tighter">${proj.property}</span>
                                <h3 class="font-black text-slate-900 text-lg mt-1 group-hover:text-orange-600 transition-colors">${proj.name}</h3>
                            </div>
                            <button data-action="project-delete" data-id="${proj.id}" class="text-slate-200 hover:text-red-500 transition-colors">
                                <i class="fa fa-times-circle"></i>
                            </button>
                        </div>

                        <div class="space-y-5">
                            <div>
                                <div class="flex justify-between text-[10px] font-black uppercase mb-1.5 tracking-widest">
                                    <span class="text-slate-400">Progress</span>
                                    <span class="text-slate-900">${percentComplete}%</span>
                                </div>
                                <div class="w-full bg-slate-50 h-2 rounded-full border border-slate-100">
                                    <div class="bg-slate-900 h-full rounded-full transition-all duration-700" style="width: ${percentComplete}%"></div>
                                </div>
                            </div>

                            <div class="grid grid-cols-2 gap-4">
                                <div class="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <p class="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Budgeted</p>
                                    <p class="text-sm font-black text-slate-900">${formatters.compact(proj.budget)}</p>
                                </div>
                                <div class="p-3 bg-slate-50 rounded-xl border border-slate-100">
                                    <p class="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-1">Status</p>
                                    <span class="text-[10px] font-black uppercase ${statusClass}">${proj.status}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="px-5 py-4 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center">
                        <div class="flex flex-col">
                            <span class="text-[10px] text-slate-400 font-bold uppercase tracking-tighter leading-none mb-1">Lead Vendor</span>
                            <span class="text-xs font-black text-slate-700 truncate max-w-[120px]">${proj.lead || 'Internal'}</span>
                        </div>
                        <button data-action="project-edit" data-id="${proj.id}" class="bg-white border border-slate-200 text-slate-900 text-[10px] font-black uppercase px-3 py-1.5 rounded-lg hover:border-slate-900 transition-all shadow-sm">
                            Manage Spend
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    },

    bindEvents() {
        const addBtn = document.getElementById('add-project-btn');
        if (addBtn) addBtn.onclick = () => this.showAddProjectModal();

        document.querySelectorAll('[data-action="project-delete"]').forEach(btn => {
            btn.onclick = (e) => {
                const id = e.currentTarget.dataset.id;
                if (confirm("Cancel this project?")) stateManager.delete('projects', id);
            };
        });
    },

    showAddProjectModal() {
        const state = stateManager.get();
        const propertyOptions = (state.properties || []).map(p => `<option value="${p.name}">${p.name}</option>`).join('');

        const formHtml = `
            <div class="space-y-5">
                <div>
                    <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Scope of Work</label>
                    <input type="text" id="proj-name" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 transition-all" placeholder="e.g. Lobby Renovation">
                </div>
                <div>
                    <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Asset Selection</label>
                    <select id="proj-property" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none cursor-pointer">
                        <option value="">Select Property...</option>
                        ${propertyOptions}
                    </select>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Total Budget ($)</label>
                        <input type="number" id="proj-budget" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="0">
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Current Status</label>
                        <select id="proj-status" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none cursor-pointer">
                            <option>Planning</option>
                            <option>In Progress</option>
                            <option>On Hold</option>
                            <option>Completed</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">General Contractor / Vendor</label>
                    <input type="text" id="proj-lead" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" placeholder="e.g. Summit Construction LLC">
                </div>
            </div>
        `;

        modalManager.show("New CapEx Project", formHtml, () => {
            const data = {
                name: document.getElementById('proj-name').value,
                property: document.getElementById('proj-property').value,
                budget: parseFloat(document.getElementById('proj-budget').value) || 0,
                status: document.getElementById('proj-status').value,
                lead: document.getElementById('proj-lead').value,
                spent: 0,
                percent_complete: 0,
                createdAt: new Date().toISOString()
            };

            if (data.name && data.property) {
                stateManager.add('projects', data);
            }
        });
    },

    getStatusClass(status) {
        switch (status) {
            case 'Completed': return 'text-emerald-600';
            case 'In Progress': return 'text-blue-600';
            case 'Planning': return 'text-amber-600';
            default: return 'text-slate-400';
        }
    }
};