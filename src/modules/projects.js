/**
 * src/modules/projects.js
 * Tracks Capital Expenditures (CapEx) and Value-Add Renovations.
 */

import { stateManager } from '../state.js';
import { formatters } from '../utils/formatters.js';
import { modalManager } from '../utils/modals.js';

export function renderProjects(projects) {
    const container = document.getElementById('view-projects');
    if (!container) return;

    // 1. Calculate Summary Stats
    const totalBudget = projects.reduce((sum, p) => sum + (parseFloat(p.budget) || 0), 0);
    const totalSpent = projects.reduce((sum, p) => sum + (parseFloat(p.spent) || 0), 0);
    const activeProjects = projects.filter(p => p.status !== 'Completed').length;

    container.innerHTML = `
        <div class="p-6">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h2 class="text-2xl font-bold text-gray-900">CapEx & Renovations</h2>
                    <p class="text-sm text-gray-500 font-medium">
                        ${activeProjects} Active Projects • Total Budget: ${formatters.compact(totalBudget)}
                    </p>
                </div>
                <button data-action="project-add" class="bg-slate-900 text-white px-5 py-2.5 rounded-lg hover:bg-slate-800 font-bold shadow-sm transition-all flex items-center text-sm">
                    <i class="fa fa-tools mr-2"></i>New Project
                </button>
            </div>

            <div class="bg-white p-6 rounded-xl border border-gray-200 shadow-sm mb-8">
                <div class="flex justify-between items-end mb-2">
                    <span class="text-xs font-bold text-gray-400 uppercase tracking-widest">Aggregate Portfolio Spend</span>
                    <span class="text-sm font-black text-slate-900">${formatters.dollars(totalSpent)} / ${formatters.dollars(totalBudget)}</span>
                </div>
                <div class="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                    <div class="bg-orange-500 h-full transition-all duration-1000" style="width: ${(totalSpent / totalBudget) * 100 || 0}%"></div>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                ${renderProjectCards(projects)}
            </div>
        </div>
    `;
}

function renderProjectCards(projects) {
    if (projects.length === 0) return `<div class="col-span-full py-20 text-center text-gray-400 border-2 border-dashed rounded-xl bg-white">No active CapEx projects.</div>`;

    return projects.map(proj => {
        const percentComplete = proj.status === 'Completed' ? 100 : (proj.percent_complete || 0);
        
        return `
            <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                <div class="p-5">
                    <div class="flex justify-between items-start mb-4">
                        <div>
                            <span class="text-[10px] font-black text-orange-600 uppercase bg-orange-50 px-2 py-0.5 rounded">${proj.property}</span>
                            <h3 class="font-bold text-gray-900 text-lg mt-1">${proj.name}</h3>
                        </div>
                        <button data-action="project-delete" data-id="${proj.id}" class="text-gray-300 hover:text-red-500">
                            <i class="fa fa-trash-alt text-xs"></i>
                        </button>
                    </div>

                    <div class="space-y-4">
                        <div>
                            <div class="flex justify-between text-[10px] font-bold uppercase mb-1">
                                <span class="text-gray-400">Completion</span>
                                <span class="text-gray-900">${percentComplete}%</span>
                            </div>
                            <div class="w-full bg-gray-50 h-1.5 rounded-full">
                                <div class="bg-slate-900 h-1.5 rounded-full" style="width: ${percentComplete}%"></div>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-4 pt-2">
                            <div>
                                <p class="text-[10px] text-gray-400 font-bold uppercase">Budget</p>
                                <p class="text-sm font-bold text-gray-900">${formatters.compact(proj.budget)}</p>
                            </div>
                            <div>
                                <p class="text-[10px] text-gray-400 font-bold uppercase">Status</p>
                                <p class="text-sm font-bold text-slate-600">${proj.status}</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-between items-center text-[11px]">
                    <span class="text-gray-500 italic">Project Lead: ${proj.lead || 'N/A'}</span>
                    <button class="font-bold text-slate-900 hover:underline">Update Spend</button>
                </div>
            </div>
        `;
    }).join('');
}

export function showAddProjectModal() {
    const state = stateManager.get();
    const propertyOptions = state.properties.map(p => `<option value="${p.name}">${p.name}</option>`).join('');

    const formHtml = `
        <div class="space-y-4">
            <div>
                <label class="block text-xs font-black text-gray-400 uppercase mb-1">Project Name</label>
                <input type="text" id="name" class="w-full p-3 border rounded-lg outline-none" placeholder="e.g. Roof Replacement Phase 1">
            </div>
            <div>
                <label class="block text-xs font-black text-gray-400 uppercase mb-1">Select Property</label>
                <select id="property" class="w-full p-3 border rounded-lg outline-none">
                    <option value="">Choose Property...</option>
                    ${propertyOptions}
                </select>
            </div>
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-xs font-black text-gray-400 uppercase mb-1">Total Budget</label>
                    <input type="number" id="budget" class="w-full p-3 border rounded-lg outline-none">
                </div>
                <div>
                    <label class="block text-xs font-black text-gray-400 uppercase mb-1">Current Status</label>
                    <select id="status" class="w-full p-3 border rounded-lg outline-none">
                        <option>Planning</option>
                        <option>In Progress</option>
                        <option>On Hold</option>
                        <option>Completed</option>
                    </select>
                </div>
            </div>
            <div>
                <label class="block text-xs font-black text-gray-400 uppercase mb-1">Project Lead / Vendor</label>
                <input type="text" id="lead" class="w-full p-3 border rounded-lg outline-none" placeholder="e.g. Master Roofing Co.">
            </div>
        </div>
    `;

    modalManager.show("New CapEx Project", formHtml, (data) => {
        stateManager.add('projects', { ...data, spent: 0, percent_complete: 0 });
    });
}