/**
 * src/utils/uploads.js
 * Handles file processing, Firebase Storage integration, and validation.
 */

import { stateManager } from '../state.js';

// Configuration
const MAX_FILE_SIZE_MB = 15;
const ALLOWED_TYPES = {
    'application/pdf': { label: 'PDF', icon: 'fa-file-pdf', color: 'text-red-500' },
    'image/jpeg': { label: 'JPEG', icon: 'fa-file-image', color: 'text-blue-500' },
    'image/png': { label: 'PNG', icon: 'fa-file-image', color: 'text-blue-500' },
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { label: 'Excel', icon: 'fa-file-excel', color: 'text-emerald-600' },
    'application/vnd.ms-excel': { label: 'Excel', icon: 'fa-file-excel', color: 'text-emerald-600' }
};

export const uploadManager = {
    
    /**
     * Main upload handler
     * @param {File} file - The file object from the input
     * @param {string} path - The storage path (e.g., 'deals/deal_123/docs')
     */
    async uploadFile(file, path, onProgress) {
        if (!this.validate(file)) return null;

        try {
            console.log(`Initializing upload for ${file.name}...`);
            
            // Simulation of Firebase upload progress
            if (onProgress) {
                for (let i = 0; i <= 100; i += 20) {
                    onProgress(i);
                    await new Promise(r => setTimeout(r, 100));
                }
            }

            // MOCK URL GENERATION 
            // In production, replace with: 
            // const storageRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
            // const snapshot = await uploadBytes(storageRef, file);
            // const downloadURL = await getDownloadURL(snapshot.ref);
            const downloadURL = `https://firebasestorage.mock.com/${path}/${file.name}`;

            stateManager.logActivity(`Document Secured: ${file.name}`);

            return {
                id: `doc_${Date.now()}`,
                name: file.name,
                url: downloadURL,
                type: file.type,
                size: (file.size / 1024).toFixed(1) + ' KB',
                uploadedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error("Upload failed:", error);
            this.notifyUser("System error during upload. Please retry.", "error");
            return null;
        }
    },

    /**
     * Basic validation for size and type
     */
    validate(file) {
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            this.notifyUser(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit.`, "warning");
            return false;
        }
        if (!Object.keys(ALLOWED_TYPES).includes(file.type)) {
            this.notifyUser("Invalid format. Use PDF, Excel, or high-res Images.", "warning");
            return false;
        }
        return true;
    },

    /**
     * Renders a premium, interactive Dropzone
     */
    renderDropzone(containerId, onComplete) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = `
            <div class="space-y-4">
                <div id="drop-area" class="group border-2 border-dashed border-slate-200 rounded-[2rem] p-10 text-center hover:border-slate-900 hover:bg-slate-50 transition-all cursor-pointer relative overflow-hidden">
                    <input type="file" id="file-input" class="hidden" multiple>
                    
                    <div id="upload-idle-state" class="space-y-3">
                        <div class="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto group-hover:rotate-6 transition-transform">
                            <i class="fa fa-arrow-up-from-bracket text-slate-400 group-hover:text-slate-900"></i>
                        </div>
                        <div>
                            <p class="text-sm font-black text-slate-900 uppercase tracking-tight">Deploy Documents</p>
                            <p class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">PDF, Excel, or PNG up to 15MB</p>
                        </div>
                    </div>

                    <div id="upload-active-state" class="hidden space-y-4">
                        <div class="flex items-center justify-center gap-3">
                            <div class="w-2 h-2 bg-slate-900 rounded-full animate-bounce"></div>
                            <div class="w-2 h-2 bg-slate-900 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                            <div class="w-2 h-2 bg-slate-900 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                        </div>
                        <p class="text-[10px] font-black text-slate-900 uppercase tracking-widest">Encrypting & Uploading...</p>
                        <div class="w-full bg-slate-100 h-1 rounded-full max-w-[200px] mx-auto overflow-hidden">
                            <div id="progress-bar-fill" class="bg-slate-900 h-full w-0 transition-all duration-300"></div>
                        </div>
                    </div>
                </div>
                <div id="file-preview-zone" class="grid grid-cols-1 gap-2"></div>
            </div>
        `;

        const input = container.querySelector('#file-input');
        const area = container.querySelector('#drop-area');
        const idleState = container.querySelector('#upload-idle-state');
        const activeState = container.querySelector('#upload-active-state');
        const progressFill = container.querySelector('#progress-bar-fill');

        area.onclick = () => input.click();

        input.onchange = async (e) => {
            const files = Array.from(e.target.files);
            if (files.length === 0) return;

            // Switch UI to active state
            idleState.classList.add('hidden');
            activeState.classList.remove('hidden');

            for (const file of files) {
                const result = await this.uploadFile(file, 'vault/deals', (pct) => {
                    progressFill.style.width = `${pct}%`;
                });

                if (result) {
                    this.addFileToPreview(result, containerId);
                    if (onComplete) onComplete(result);
                }
            }

            // Reset UI
            setTimeout(() => {
                idleState.classList.remove('hidden');
                activeState.classList.add('hidden');
                progressFill.style.width = '0%';
            }, 1000);
        };
    },

    addFileToPreview(fileObj, containerId) {
        const previewZone = document.getElementById('file-preview-zone');
        if (!previewZone) return;

        const config = ALLOWED_TYPES[fileObj.type] || { icon: 'fa-file', color: 'text-slate-400' };

        const card = document.createElement('div');
        card.className = "flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm animate-slide-up";
        card.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center ${config.color}">
                    <i class="fa ${config.icon}"></i>
                </div>
                <div>
                    <p class="text-xs font-black text-slate-900 truncate max-w-[150px]">${fileObj.name}</p>
                    <p class="text-[9px] font-bold text-slate-400 uppercase tracking-widest">${fileObj.size} • ${config.label}</p>
                </div>
            </div>
            <a href="${fileObj.url}" target="_blank" class="text-slate-300 hover:text-slate-900 transition-colors">
                <i class="fa fa-external-link text-xs"></i>
            </a>
        `;
        previewZone.prepend(card);
    },

    notifyUser(msg, type) {
        // Fallback to alert, but designed for future Toast implementation
        console.log(`[${type.toUpperCase()}] ${msg}`);
        alert(msg);
    }
};