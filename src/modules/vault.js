/**
 * src/modules/vault.js
 * Centralized repository for document links, file metadata, and version control.
 */

import { stateManager } from '../state.js';
import { modalManager } from '../utils/modals.js';

export const vault = {
    currentFilter: 'All',

    render() {
        const container = document.getElementById('view-vault');
        if (!container) return;

        const state = stateManager.get();
        const documents = state.vault || [];
        
        const filteredDocs = this.currentFilter === 'All' 
            ? documents 
            : documents.filter(d => d.category === this.currentFilter);

        container.innerHTML = `
            <div class="p-8 max-w-7xl mx-auto space-y-8">
                <div class="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <div class="flex items-center gap-2 text-emerald-600 font-black uppercase tracking-[0.3em] text-[10px] mb-2">
                            <span class="w-6 h-[2px] bg-emerald-600"></span>
                            Version Control Active
                        </div>
                        <h2 class="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">The Vault</h2>
                        <p class="text-sm text-slate-500 font-medium mt-1">Audit-ready document repository with revision history.</p>
                    </div>
                    
                    <button id="vault-add-btn" class="bg-slate-900 text-white px-6 py-3 rounded-xl hover:bg-slate-800 font-black shadow-xl shadow-slate-200 transition-all flex items-center text-[10px] uppercase tracking-widest">
                        <i class="fa fa-plus-circle mr-2"></i>New Master Record
                    </button>
                </div>

                <div class="flex gap-2 overflow-x-auto pb-4 no-scrollbar border-b border-slate-100">
                    ${['All', 'Legal', 'Financial', 'Property', 'Investor'].map(cat => `
                        <button data-filter="${cat}" class="vault-filter-btn px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${this.currentFilter === cat ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-400 border border-slate-100 hover:border-slate-900 hover:text-slate-900'}">
                            ${cat}
                        </button>
                    `).join('')}
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    ${this.renderFileCards(filteredDocs)}
                </div>
            </div>
        `;

        this.initListeners();
    },

    renderFileCards(docs) {
        if (docs.length === 0) {
            return `<div class="col-span-full py-32 text-center bg-slate-50 border-2 border-dashed border-slate-200 rounded-[3rem]">
                <p class="text-slate-400 text-xs font-black uppercase tracking-widest">No records in this archive.</p>
            </div>`;
        }

        return docs.map(doc => {
            const history = doc.revisions || [];
            const versionCount = history.length;
            const latestUrl = versionCount > 0 ? history[0].url : doc.url;

            return `
                <div class="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
                    <div class="flex items-start justify-between mb-6">
                        <div class="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all">
                            <i class="fa ${this.getFileIcon(doc.category)} text-xl"></i>
                        </div>
                        <div class="flex flex-col items-end gap-1">
                            <span class="text-[8px] font-black px-2 py-0.5 rounded bg-slate-900 text-white uppercase">v${versionCount || 1}.0</span>
                            <button data-action="vault-delete" data-id="${doc.id}" class="text-slate-200 hover:text-red-500 transition-colors p-1">
                                <i class="fa fa-trash-alt text-[10px]"></i>
                            </button>
                        </div>
                    </div>
                    
                    <div class="mb-6">
                        <h3 class="font-black text-slate-900 text-sm mb-1 truncate tracking-tight">${doc.name}</h3>
                        <p class="text-[9px] font-bold text-slate-400 uppercase tracking-widest">${doc.category} • ${doc.linked_to || 'General'}</p>
                    </div>

                    <div class="mb-4 space-y-2">
                        <button data-action="view-history" data-id="${doc.id}" class="w-full text-left px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors flex items-center justify-between">
                            <span class="text-[10px] font-black text-slate-500 uppercase">Revision History</span>
                            <i class="fa fa-history text-[10px] text-slate-400"></i>
                        </button>
                    </div>
                    
                    <a href="${latestUrl}" target="_blank" class="flex items-center justify-center gap-2 w-full bg-slate-900 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-orange-600 transition-all">
                        View Latest <i class="fa fa-external-link-alt text-[8px]"></i>
                    </a>
                </div>
            `;
        }).join('');
    },

    getFileIcon(category) {
        const mapping = { 'legal': 'fa-file-shield', 'financial': 'fa-file-invoice-dollar', 'property': 'fa-building', 'investor': 'fa-user-tie' };
        return mapping[category.toLowerCase()] || 'fa-file-alt';
    },

    initListeners() {
        const addBtn = document.getElementById('vault-add-btn');
        if (addBtn) addBtn.onclick = () => this.showAddModal();

        document.querySelectorAll('.vault-filter-btn').forEach(btn => {
            btn.onclick = () => { this.currentFilter = btn.dataset.filter; this.render(); };
        });

        document.querySelectorAll('[data-action="vault-delete"]').forEach(btn => {
            btn.onclick = () => {
                if(confirm("Purge record and all version history?")) {
                    stateManager.delete('vault', btn.dataset.id);
                    this.render();
                }
            };
        });

        document.querySelectorAll('[data-action="view-history"]').forEach(btn => {
            btn.onclick = () => this.showHistoryModal(btn.dataset.id);
        });
    },

    showHistoryModal(docId) {
        const doc = stateManager.get().vault.find(d => d.id === docId);
        const history = doc.revisions || [{ url: doc.url, date: doc.createdAt || new Date().toISOString(), note: 'Original Upload' }];

        const historyHtml = `
            <div class="space-y-4">
                <div class="max-h-60 overflow-y-auto space-y-2 pr-2">
                    ${history.map((rev, idx) => `
                        <div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <div>
                                <p class="text-xs font-black text-slate-900">Version ${history.length - idx}.0</p>
                                <p class="text-[10px] font-medium text-slate-500">${new Date(rev.date).toLocaleDateString()} • ${rev.note || 'No notes'}</p>
                            </div>
                            <a href="${rev.url}" target="_blank" class="p-2 bg-white rounded-lg shadow-sm hover:text-orange-600 transition-colors">
                                <i class="fa fa-download text-xs"></i>
                            </a>
                        </div>
                    `).join('')}
                </div>
                <div class="pt-4 border-t border-slate-100">
                    <label class="block text-[10px] font-black text-slate-400 uppercase mb-2">Upload New Revision</label>
                    <div class="grid grid-cols-1 gap-3">
                        <input type="url" id="new-rev-url" class="p-3 bg-slate-50 border rounded-xl text-xs" placeholder="New Revision URL">
                        <input type="text" id="new-rev-note" class="p-3 bg-slate-50 border rounded-xl text-xs" placeholder="What changed? (e.g. Added legal redlines)">
                        <button id="add-rev-btn" class="bg-slate-900 text-white py-3 rounded-xl font-black text-[10px] uppercase">Commit Revision</button>
                    </div>
                </div>
            </div>
        `;

        modalManager.show(`History: ${doc.name}`, historyHtml, null);

        // Handle Revision Addition
        document.getElementById('add-rev-btn').onclick = () => {
            const url = document.getElementById('new-rev-url').value;
            const note = document.getElementById('new-rev-note').value;
            if (!url) return alert("URL required");

            const newRevisions = [{ url, note, date: new Date().toISOString() }, ...history];
            stateManager.update('vault', docId, { revisions: newRevisions });
            modalManager.hide();
            this.render();
        };
    },

    showAddModal() {
        const state = stateManager.get();
        const propertyNames = (state.properties || []).map(p => `<option value="${p.name}">${p.name}</option>`).join('');

        const formHtml = `
            <div class="space-y-4">
                <div>
                    <label class="block text-[10px] font-black text-slate-400 uppercase mb-2">Master Document Name</label>
                    <input type="text" id="doc-name" class="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-sm" placeholder="e.g. LP Subscription Agreement">
                </div>
                <div>
                    <label class="block text-[10px] font-black text-slate-400 uppercase mb-2">Initial Version URL</label>
                    <input type="url" id="doc-url" class="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-sm" placeholder="https://...">
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-[10px] font-black text-slate-400 uppercase mb-2">Category</label>
                        <select id="doc-category" class="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-sm">
                            <option>Legal</option><option>Financial</option><option>Property</option><option>Investor</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-slate-400 uppercase mb-2">Link Entity</label>
                        <select id="doc-link" class="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-sm">
                            <option value="">General</option>${propertyNames}
                        </select>
                    </div>
                </div>
            </div>
        `;

        modalManager.show("Create Master Record", formHtml, () => {
            const url = document.getElementById('doc-url').value;
            const data = {
                id: `doc_${Date.now()}`,
                name: document.getElementById('doc-name').value,
                category: document.getElementById('doc-category').value,
                linked_to: document.getElementById('doc-link').value,
                revisions: [{ url, date: new Date().toISOString(), note: 'Initial Master Version' }],
                createdAt: new Date().toISOString()
            };
            if (data.name && url) {
                stateManager.add('vault', data);
                this.render();
            }
        });
    }
};