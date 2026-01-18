/**
 * src/modules/vault.js
 * Centralized repository for document links and file metadata.
 */

import { stateManager } from '../state.js';
import { modalManager } from '../utils/modals.js';

export const vault = {
    render() {
        const container = document.getElementById('view-vault');
        if (!container) return;

        const state = stateManager.get();
        const documents = state.vault || [];

        container.innerHTML = `
            <div class="p-8">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h2 class="text-2xl font-bold text-gray-900">Document Vault</h2>
                        <p class="text-sm text-gray-500 font-medium">Secure access to closing docs, legal files, and pitch decks.</p>
                    </div>
                    <button data-action="vault-add" class="bg-slate-900 text-white px-5 py-2.5 rounded-lg hover:bg-slate-800 font-bold shadow-sm transition-all flex items-center text-sm">
                        <i class="fa fa-cloud-upload mr-2"></i>Link Document
                    </button>
                </div>

                <div class="flex gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
                    ${['All', 'Legal', 'Financial', 'Property', 'Investor'].map(cat => `
                        <button class="px-4 py-1.5 rounded-full border border-gray-200 bg-white text-xs font-bold text-gray-500 hover:border-slate-900 hover:text-slate-900 transition-all">
                            ${cat}
                        </button>
                    `).join('')}
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${this.renderFileCards(documents)}
                </div>
            </div>
        `;
    },

    renderFileCards(docs) {
        if (docs.length === 0) {
            return `<div class="col-span-full py-20 text-center text-gray-400 border-2 border-dashed rounded-xl bg-white">
                <i class="fa fa-folder-open text-4xl mb-3 opacity-20"></i>
                <p>No documents linked yet. Upload to your cloud and link them here.</p>
            </div>`;
        }

        return docs.map(doc => `
            <div class="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all group">
                <div class="flex items-start justify-between mb-4">
                    <div class="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-orange-50 group-hover:text-orange-600 transition-colors">
                        <i class="fa ${this.getFileIcon(doc.category)} text-xl"></i>
                    </div>
                    <button data-action="vault-delete" data-id="${doc.id}" class="text-gray-300 hover:text-red-500 transition-colors">
                        <i class="fa fa-trash-alt text-xs"></i>
                    </button>
                </div>
                
                <h3 class="font-bold text-gray-900 text-sm mb-1 truncate">${doc.name}</h3>
                <p class="text-[10px] font-bold text-gray-400 uppercase mb-4">${doc.category} • ${doc.linked_to || 'General'}</p>
                
                <a href="${doc.url}" target="_blank" class="block w-full text-center bg-slate-50 hover:bg-slate-900 hover:text-white py-2 rounded-xl text-xs font-black transition-all">
                    VIEW DOCUMENT <i class="fa fa-external-link-alt ml-1 text-[10px]"></i>
                </a>
            </div>
        `).join('');
    },

    getFileIcon(category) {
        switch(category.toLowerCase()) {
            case 'legal': return 'fa-file-shield';
            case 'financial': return 'fa-file-invoice-dollar';
            case 'property': return 'fa-building';
            case 'investor': return 'fa-user-tie';
            default: return 'fa-file-alt';
        }
    },

    showAddModal() {
        const state = stateManager.get();
        // Get list of properties and investors for linking
        const propertyNames = state.properties.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
        const investorNames = state.investors.map(i => `<option value="${i.name}">${i.name}</option>`).join('');

        const formHtml = `
            <div class="space-y-4">
                <div>
                    <label class="block text-[10px] font-black text-gray-400 uppercase mb-1">Document Name</label>
                    <input type="text" id="doc-name" class="w-full p-3 border rounded-xl outline-none" placeholder="e.g. 2024 Tax Return - Sunset Apts">
                </div>
                <div>
                    <label class="block text-[10px] font-black text-gray-400 uppercase mb-1">Cloud URL (Dropbox/Drive/S3)</label>
                    <input type="url" id="doc-url" class="w-full p-3 border rounded-xl outline-none" placeholder="https://...">
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-[10px] font-black text-gray-400 uppercase mb-1">Category</label>
                        <select id="doc-category" class="w-full p-3 border rounded-xl outline-none">
                            <option>Legal</option>
                            <option>Financial</option>
                            <option>Property</option>
                            <option>Investor</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-[10px] font-black text-gray-400 uppercase mb-1">Link to Entity (Optional)</label>
                        <select id="doc-link" class="w-full p-3 border rounded-xl outline-none">
                            <option value="">General Vault</option>
                            <optgroup label="Properties">
                                ${propertyNames}
                            </optgroup>
                            <optgroup label="Investors">
                                ${investorNames}
                            </optgroup>
                        </select>
                    </div>
                </div>
            </div>
        `;

        modalManager.show("Link New Document", formHtml, () => {
            const data = {
                name: document.getElementById('doc-name').value,
                url: document.getElementById('doc-url').value,
                category: document.getElementById('doc-category').value,
                linked_to: document.getElementById('doc-link').value
            };
            stateManager.add('vault', data);
        });
    }
};