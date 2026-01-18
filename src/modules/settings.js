/**
 * src/modules/settings.js
 * Manages user profile, branding, and global application preferences.
 */

import { stateManager } from '../state.js';
import { auth } from '../firebase.js';

export const settingsModule = {
    render() {
        const container = document.getElementById('view-settings');
        if (!container) return;

        const state = stateManager.get();
        const user = auth.currentUser;
        const config = state.settings || { companyName: 'Summit Capital', currency: 'USD' };

        container.innerHTML = `
            <div class="p-8 max-w-4xl">
                <div class="mb-8">
                    <h2 class="text-2xl font-bold text-gray-900">System Settings</h2>
                    <p class="text-sm text-gray-500 font-medium">Manage your organization branding and global preferences.</p>
                </div>

                <div class="grid grid-cols-1 gap-8">
                    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                        <div class="p-6 border-b border-gray-50 bg-gray-50/50">
                            <h3 class="font-bold text-gray-900 text-sm uppercase tracking-wider">User Profile</h3>
                        </div>
                        <div class="p-6 flex items-center gap-6">
                            <div class="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center text-white text-2xl font-black">
                                ${user?.email?.charAt(0).toUpperCase() || 'U'}
                            </div>
                            <div>
                                <p class="text-sm font-bold text-gray-900">${user?.email || 'User Account'}</p>
                                <p class="text-xs text-gray-400">UID: ${user?.uid.substring(0, 12)}...</p>
                                <button data-action="logout" class="mt-2 text-xs font-bold text-red-600 hover:underline">Sign Out of All Devices</button>
                            </div>
                        </div>
                    </div>

                    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                        <div class="p-6 border-b border-gray-50 bg-gray-50/50">
                            <h3 class="font-bold text-gray-900 text-sm uppercase tracking-wider">Organization Branding</h3>
                        </div>
                        <form id="settings-form" class="p-6 space-y-6">
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label class="block text-[10px] font-black text-gray-400 uppercase mb-2">Company Name</label>
                                    <input type="text" name="companyName" value="${config.companyName}" 
                                        class="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none text-sm transition-all">
                                </div>
                                <div>
                                    <label class="block text-[10px] font-black text-gray-400 uppercase mb-2">Global Currency</label>
                                    <select name="currency" class="w-full p-3 border border-gray-200 rounded-xl outline-none text-sm">
                                        <option value="USD" ${config.currency === 'USD' ? 'selected' : ''}>USD ($)</option>
                                        <option value="EUR" ${config.currency === 'EUR' ? 'selected' : ''}>EUR (€)</option>
                                        <option value="GBP" ${config.currency === 'GBP' ? 'selected' : ''}>GBP (£)</option>
                                        <option value="CAD" ${config.currency === 'CAD' ? 'selected' : ''}>CAD ($)</option>
                                    </select>
                                </div>
                            </div>

                            <div class="pt-4">
                                <button type="submit" class="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>

                    <div class="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 flex items-center justify-between">
                        <div>
                            <h3 class="font-bold text-gray-900 text-sm uppercase">Data Portability</h3>
                            <p class="text-xs text-gray-400 mt-1">Download your entire portfolio and deal database as a JSON backup.</p>
                        </div>
                        <button id="export-data" class="text-xs font-bold bg-white border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50">
                            Export JSON
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.initListeners();
    },

    initListeners() {
        const form = document.getElementById('settings-form');
        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                const updates = {
                    companyName: formData.get('companyName'),
                    currency: formData.get('currency')
                };

                // Update state and notify UI
                const currentState = stateManager.get();
                stateManager.updateSettings(updates);
                
                alert('Settings saved successfully!');
            };
        }

        const exportBtn = document.getElementById('export-data');
        if (exportBtn) {
            exportBtn.onclick = () => {
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(stateManager.get()));
                const downloadAnchorNode = document.createElement('a');
                downloadAnchorNode.setAttribute("href", dataStr);
                downloadAnchorNode.setAttribute("download", "summit_crm_backup.json");
                document.body.appendChild(downloadAnchorNode);
                downloadAnchorNode.click();
                downloadAnchorNode.remove();
            };
        }
    }
};