/**
 * src/modules/contacts.js
 * Manages general business relationships (Brokers, Lenders, Vendors).
 */

import { stateManager } from '../state.js';
import { formatters } from '../utils/formatters.js';
import { modalManager } from '../utils/modals.js';

export const contacts = {
    /**
     * Main render function called by the router
     */
    render(state) {
        const container = document.getElementById('view-contacts');
        if (!container) return;

        const contactList = state.contacts || [];

        container.innerHTML = `
            <div class="p-6">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h2 class="text-2xl font-bold text-gray-900">Contact Directory</h2>
                        <p class="text-sm text-gray-500 font-medium">
                            Managing ${contactList.length} professional relationships across your markets.
                        </p>
                    </div>
                    <button id="add-contact-btn" class="bg-slate-900 text-white px-5 py-2.5 rounded-lg hover:bg-slate-800 font-bold shadow-sm transition-all flex items-center text-sm">
                        <i class="fa fa-plus mr-2"></i>Add Contact
                    </button>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                    ${this.renderContactCards(contactList)}
                </div>
            </div>
        `;

        this.bindEvents();
    },

    renderContactCards(contactList) {
        if (contactList.length === 0) {
            return `
                <div class="col-span-full py-20 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-white">
                    <i class="fa fa-address-book text-4xl mb-3 opacity-20"></i>
                    <p>No contacts found. Start building your network.</p>
                </div>`;
        }

        return contactList.map(contact => {
            const categoryClass = this.getCategoryClass(contact.category);
            const initials = contact.name ? contact.name.charAt(0).toUpperCase() : '?';
            
            return `
                <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow group">
                    <div class="p-5">
                        <div class="flex justify-between items-start mb-4">
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${categoryClass}">
                                ${contact.category || 'General'}
                            </span>
                            <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button data-action="contact-edit" data-id="${contact.id}" class="text-gray-400 hover:text-slate-600">
                                    <i class="fa fa-pen text-xs"></i>
                                </button>
                                <button data-action="contact-delete" data-id="${contact.id}" class="text-gray-400 hover:text-red-500">
                                    <i class="fa fa-trash text-xs"></i>
                                </button>
                            </div>
                        </div>

                        <div class="text-center mb-4">
                            <div class="w-16 h-16 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xl font-bold mx-auto mb-2 border-2 border-white shadow-sm">
                                ${initials}
                            </div>
                            <h3 class="font-bold text-gray-900 text-lg">${contact.name}</h3>
                            <p class="text-xs text-gray-500 font-medium">${contact.company || 'Independent'}</p>
                        </div>

                        <div class="space-y-2 pt-4 border-t border-gray-50">
                            <div class="flex items-center text-sm text-gray-600">
                                <i class="fa fa-envelope w-5 text-gray-300"></i>
                                <span class="truncate">${contact.email || 'No email'}</span>
                            </div>
                            <div class="flex items-center text-sm text-gray-600">
                                <i class="fa fa-phone w-5 text-gray-300"></i>
                                <span>${contact.phone || 'No phone'}</span>
                            </div>
                        </div>
                    </div>

                    <div class="bg-gray-50 px-5 py-3 flex gap-2">
                        <a href="mailto:${contact.email}" class="flex-grow text-center bg-white border border-gray-200 py-1.5 rounded text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors">
                            Email
                        </a>
                        <a href="tel:${contact.phone}" class="flex-grow text-center bg-white border border-gray-200 py-1.5 rounded text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors">
                            Call
                        </a>
                    </div>
                </div>
            `;
        }).join('');
    },

    bindEvents() {
        const addBtn = document.getElementById('add-contact-btn');
        if (addBtn) addBtn.onclick = () => this.showAddContactModal();

        // Delete delegation
        document.querySelectorAll('[data-action="contact-delete"]').forEach(btn => {
            btn.onclick = (e) => {
                const id = e.currentTarget.dataset.id;
                if (confirm("Delete this contact permanently?")) {
                    stateManager.delete('contacts', id);
                }
            };
        });
    },

    showAddContactModal() {
        const formHtml = `
            <div class="grid grid-cols-2 gap-4">
                <div class="col-span-2">
                    <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Full Name</label>
                    <input type="text" id="contact-name" class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" placeholder="e.g. Sarah Jenkins">
                </div>
                <div class="col-span-2">
                    <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Company / Firm</label>
                    <input type="text" id="contact-company" class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" placeholder="e.g. CBRE or Chase Bank">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Category</label>
                    <select id="contact-category" class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none">
                        <option>Broker</option>
                        <option>Lender</option>
                        <option>Attorney</option>
                        <option>Property Manager</option>
                        <option>Contractor</option>
                        <option>Insurance</option>
                        <option>General</option>
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Phone Number</label>
                    <input type="tel" id="contact-phone" class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none" placeholder="555-0123">
                </div>
                <div class="col-span-2">
                    <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Email Address</label>
                    <input type="email" id="contact-email" class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none">
                </div>
            </div>
        `;

        modalManager.show("Add New Contact", formHtml, () => {
            const newContact = {
                name: document.getElementById('contact-name').value,
                company: document.getElementById('contact-company').value,
                category: document.getElementById('contact-category').value,
                phone: document.getElementById('contact-phone').value,
                email: document.getElementById('contact-email').value,
                createdAt: new Date().toISOString()
            };
            
            if (newContact.name) {
                stateManager.add('contacts', newContact);
            }
        });
    },

    getCategoryClass(cat) {
        const c = cat?.toLowerCase() || '';
        if (c === 'broker') return 'bg-indigo-50 text-indigo-600';
        if (c === 'lender') return 'bg-emerald-50 text-emerald-600';
        if (c === 'attorney') return 'bg-slate-100 text-slate-600';
        if (c === 'property manager') return 'bg-orange-50 text-orange-600';
        return 'bg-gray-50 text-gray-500';
    }
};