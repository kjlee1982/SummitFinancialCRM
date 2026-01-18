/**
 * src/modules/settings.js
 * Manages user profile, branding, and global application preferences.
 */

import { stateManager } from '../state.js';
import { auth } from '../firebase.js';

export const settingsModule = {
    /**
     * Main render function for the Settings View
     */
    render() {
        const container = document.getElementById('view-settings');
        if (!container) return;

        const state = stateManager.get();
        const user = auth.currentUser;
        const config = state.settings || { companyName: 'Summit Capital', currency: 'USD' };

        container.innerHTML = `
            <div class="p-8 max-w-5xl mx-auto space-y-8">
                <div class="flex items-end justify-between">
                    <div>
                        <h2 class="text-3xl font-black text-slate-900 tracking-tight italic uppercase">System Control</h2>
                        <p class="text-sm text-slate-500 font-medium">Configure global parameters and administrative preferences.</p>
                    </div>
                    <div class="hidden md:flex items-center gap-2 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100">
                        <span class="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                        <span class="text-[10px] font-black text-emerald-700 uppercase">System Operational</span>
                    </div>
                </div>

                <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div class="lg:col-span-1 space-y-6">
                        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div class="p-5 border-b border-slate-50 bg-slate-50/50">
                                <h3 class="font-black text-slate-900 text-[10px] uppercase tracking-[0.2em]">Operator Profile</h3>
                            </div>
                            <div class="p-6 text-center">
                                <div class="w-20 h-20 bg-slate-900 rounded-2xl flex items-center justify-center text-white text-3xl font-black mx-auto mb-4 rotate-3 shadow-xl shadow-slate-200">
                                    ${user?.email?.charAt(0).toUpperCase() || 'U'}
                                </div>
                                <p class="text-sm font-black text-slate-900 truncate">${user?.email || 'Authenticated User'}</p>
                                <p class="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tighter">Access Level: Administrator</p>
                                
                                <button id="btn-logout" class="mt-6 w-full py-2.5 rounded-xl border border-red-100 text-red-600 text-xs font-black uppercase hover:bg-red-50 transition-colors">
                                    End Session
                                </button>
                            </div>
                        </div>

                        <div class="bg-slate-900 rounded-2xl p-6 text-white">
                            <h3 class="font-black text-[10px] uppercase tracking-[0.2em] text-orange-500 mb-4">Cloud Sync</h3>
                            <div class="flex items-center justify-between text-xs mb-2">
                                <span class="text-slate-400">Database Status</span>
                                <span class="font-bold text-emerald-400">Connected</span>
                            </div>
                            <div class="flex items-center justify-between text-xs">
                                <span class="text-slate-400">Last Latency</span>
                                <span class="font-bold">24ms</span>
                            </div>
                        </div>
                    </div>

                    <div class="lg:col-span-2 space-y-6">
                        <div class="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                            <div class="p-6 border-b border-slate-50">
                                <h3 class="font-black text-slate-900 text-xs uppercase tracking-widest">Branding & Localization</h3>
                            </div>
                            <form id="settings-form" class="p-8 space-y-6">
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div class="space-y-2">
                                        <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Firm Designation</label>
                                        <input type="text" name="companyName" value="${config.companyName}" 
                                            class="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-slate-900 outline-none text-sm font-bold transition-all">
                                    </div>
                                    <div class="space-y-2">
                                        <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest">Reporting Currency</label>
                                        <select name="currency" class="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none text-sm font-bold appearance-none cursor-pointer">
                                            <option value="USD" ${config.currency === 'USD' ? 'selected' : ''}>USD ($) - United States Dollar</option>
                                            <option value="EUR" ${config.currency === 'EUR' ? 'selected' : ''}>EUR (€) - Euro</option>
                                            <option value="GBP" ${config.currency === 'GBP' ? 'selected' : ''}>GBP (£) - British Pound</option>
                                            <option value="CAD" ${config.currency === 'CAD' ? 'selected' : ''}>CAD ($) - Canadian Dollar</option>
                                        </select>
                                    </div>
                                </div>

                                <div class="pt-6 border-t border-slate-50 flex items-center justify-between">
                                    <div id="save-status" class="text-xs font-bold text-emerald-600 opacity-0 transition-opacity">
                                        <i class="fa fa-check-circle mr-1"></i> Preferences Updated
                                    </div>
                                    <button type="submit" class="bg-slate-900 text-white px-10 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-orange-600 transition-all shadow-xl shadow-slate-200">
                                        Commit Changes
                                    </button>
                                </div>
                            </form>
                        </div>

                        <div class="bg-white rounded-3xl border border-slate-200 shadow-sm p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                            <div class="flex items-center gap-4">
                                <div class="w-12 h-12 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center text-xl">
                                    <i class="fa fa-database"></i>
                                </div>
                                <div>
                                    <h3 class="font-black text-slate-900 text-sm uppercase">Legacy Data Export</h3>
                                    <p class="text-xs text-slate-400 mt-1">Download raw JSON schema for external auditing or backup.</p>
                                </div>
                            </div>
                            <button id="export-data" class="w-full md:w-auto text-[10px] font-black uppercase tracking-widest bg-white border-2 border-slate-100 px-6 py-3 rounded-xl hover:border-slate-900 transition-all">
                                Download Snapshot
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.initListeners();
    },

    /**
     * Set up event handlers for settings interactions
     */
    initListeners() {
        const form = document.getElementById('settings-form');
        const saveStatus = document.getElementById('save-status');

        if (form) {
            form.onsubmit = async (e) => {
                e.preventDefault();
                const formData = new FormData(form);
                const updates = {
                    companyName: formData.get('companyName'),
                    currency: formData.get('currency')
                };

                // Update state and persistence
                stateManager.updateSettings(updates);
                
                // Visual feedback instead of annoying alert
                if (saveStatus) {
                    saveStatus.style.opacity = '1';
                    setTimeout(() => { saveStatus.style.opacity = '0'; }, 3000);
                }
            };
        }

        const logoutBtn = document.getElementById('btn-logout');
        if (logoutBtn) {
            logoutBtn.onclick = () => {
                if (confirm("Terminate current session?")) {
                    auth.signOut().then(() => window.location.reload());
                }
            };
        }

        const exportBtn = document.getElementById('export-data');
        if (exportBtn) {
            exportBtn.onclick = () => {
                const state = stateManager.get();
                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state, null, 2));
                const downloadAnchorNode = document.createElement('a');
                downloadAnchorNode.setAttribute("href", dataStr);
                downloadAnchorNode.setAttribute("download", `summit_backup_${new Date().toISOString().split('T')[0]}.json`);
                document.body.appendChild(downloadAnchorNode);
                downloadAnchorNode.click();
                downloadAnchorNode.remove();
            };
        }
    }
};