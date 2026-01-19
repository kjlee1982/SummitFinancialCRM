/**
 * src/utils/uploads.js
 * Handles file processing, Firebase Storage integration, and validation.
 *
 * Overwrite updates included (UI kept identical):
 * - Proper scoping per container (no global #file-preview-zone lookup)
 * - Parameterized upload path in renderDropzone(containerId, onComplete, path)
 * - Modal-based warnings/errors (fallback to alert if modal unavailable)
 * - Drag & drop support (dragover/leave/drop + highlight)
 * - Clears file input value so selecting the same file again works
 * - Collision-resistant IDs (crypto.randomUUID when available)
 * - Safer link opening (rel="noopener noreferrer")
 * - Escapes filename for preview
 */

import { stateManager } from '../state.js';
import { modalManager } from '../utils/modals.js';

// Configuration
const MAX_FILE_SIZE_MB = 15;
const ALLOWED_TYPES = {
  'application/pdf': { label: 'PDF', icon: 'fa-file-pdf', color: 'text-red-500' },
  'image/jpeg': { label: 'JPEG', icon: 'fa-file-image', color: 'text-blue-500' },
  'image/png': { label: 'PNG', icon: 'fa-file-image', color: 'text-blue-500' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { label: 'Excel', icon: 'fa-file-excel', color: 'text-emerald-600' },
  'application/vnd.ms-excel': { label: 'Excel', icon: 'fa-file-excel', color: 'text-emerald-600' }
};

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safePath(path) {
  const p = String(path ?? '').trim().replace(/^\/+|\/+$/g, '');
  return p || 'vault/deals';
}

function notifyModal(title, msg) {
  try {
    if (modalManager?.show) {
      modalManager.show(
        title,
        `<p class="text-sm font-semibold text-slate-700">${escapeHtml(msg)}</p>`,
        () => true,
        { submitLabel: 'OK', hideCancel: true }
      );
      return;
    }
  } catch (_) {}
  // Fallback
  alert(msg);
}

export const uploadManager = {
  _renderedContainers: new Set(),

  /**
   * Main upload handler
   * @param {File} file - The file object from the input
   * @param {string} path - The storage path (e.g., 'deals/deal_123/docs')
   * @param {(pct:number)=>void} onProgress
   */
  async uploadFile(file, path, onProgress) {
    if (!this.validate(file)) return null;

    try {
      const targetPath = safePath(path);

      console.log(`Initializing upload for ${file.name}...`);

      // Simulation of Firebase upload progress
      if (onProgress) {
        for (let i = 0; i <= 100; i += 20) {
          onProgress(i);
          await new Promise(r => setTimeout(r, 100));
        }
      }

      // MOCK URL GENERATION
      // In production, replace with Firebase Storage upload + getDownloadURL
      const downloadURL = `https://firebasestorage.mock.com/${targetPath}/${encodeURIComponent(file.name)}`;

      stateManager.logActivity?.(`Document Secured: ${file.name}`);

      const id = `doc_${globalThis.crypto?.randomUUID?.() || Date.now().toString()}`;

      return {
        id,
        name: file.name,
        url: downloadURL,
        type: file.type,
        size: (file.size / 1024).toFixed(1) + ' KB',
        uploadedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Upload failed:', error);
      this.notifyUser('System error during upload. Please retry.', 'error');
      return null;
    }
  },

  /**
   * Basic validation for size and type
   */
  validate(file) {
    if (!file) return false;

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      this.notifyUser(`File size exceeds ${MAX_FILE_SIZE_MB}MB limit.`, 'warning');
      return false;
    }

    if (!Object.prototype.hasOwnProperty.call(ALLOWED_TYPES, file.type)) {
      this.notifyUser('Invalid format. Use PDF, Excel, or high-res Images.', 'warning');
      return false;
    }

    return true;
  },

  /**
   * Renders a premium, interactive Dropzone
   * @param {string} containerId - element id where dropzone will be rendered
   * @param {(fileObj)=>void} onComplete - callback when a file completes
   * @param {string} path - storage path (default 'vault/deals')
   */
  renderDropzone(containerId, onComplete, path = 'vault/deals') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const targetPath = safePath(path);

    // Render the same UI; allow re-render if called again for same container (to refresh view)
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

    if (!input || !area || !idleState || !activeState || !progressFill) return;

    const setActiveUi = (isActive) => {
      if (isActive) {
        idleState.classList.add('hidden');
        activeState.classList.remove('hidden');
      } else {
        idleState.classList.remove('hidden');
        activeState.classList.add('hidden');
        progressFill.style.width = '0%';
      }
    };

    const highlight = (on) => {
      if (on) {
        area.classList.add('border-slate-900', 'bg-slate-50');
        area.classList.remove('border-slate-200');
      } else {
        area.classList.remove('border-slate-900', 'bg-slate-50');
        area.classList.add('border-slate-200');
      }
    };

    const handleFiles = async (files) => {
      const arr = Array.from(files || []).filter(Boolean);
      if (arr.length === 0) return;

      setActiveUi(true);

      for (const file of arr) {
        const result = await this.uploadFile(file, targetPath, (pct) => {
          progressFill.style.width = `${pct}%`;
        });

        if (result) {
          this.addFileToPreview(result, containerId);
          if (typeof onComplete === 'function') onComplete(result);
        }
      }

      // Reset UI after a beat
      setTimeout(() => setActiveUi(false), 1000);

      // Ensure same file can be selected again
      try { input.value = ''; } catch (_) {}
    };

    // Click to open file picker
    area.onclick = () => input.click();

    // File picker selection
    input.onchange = async (e) => {
      await handleFiles(e?.target?.files);
    };

    // Drag & drop support
    const prevent = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    area.addEventListener('dragenter', (e) => { prevent(e); highlight(true); });
    area.addEventListener('dragover', (e) => { prevent(e); highlight(true); });
    area.addEventListener('dragleave', (e) => { prevent(e); highlight(false); });
    area.addEventListener('drop', async (e) => {
      prevent(e);
      highlight(false);
      const dropped = e?.dataTransfer?.files;
      await handleFiles(dropped);
    });

    // Mark container rendered (future use; we keep behavior simple)
    this._renderedContainers.add(containerId);
  },

  /**
   * Adds a file card to the preview zone *within the specified container*
   */
  addFileToPreview(fileObj, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const previewZone = container.querySelector('#file-preview-zone');
    if (!previewZone) return;

    const config = ALLOWED_TYPES[fileObj.type] || { label: 'File', icon: 'fa-file', color: 'text-slate-400' };

    const card = document.createElement('div');
    card.className = 'flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm animate-slide-up';
    card.innerHTML = `
      <div class="flex items-center gap-4">
        <div class="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center ${config.color}">
          <i class="fa ${config.icon}"></i>
        </div>
        <div>
          <p class="text-xs font-black text-slate-900 truncate max-w-[150px]">${escapeHtml(fileObj.name)}</p>
          <p class="text-[9px] font-bold text-slate-400 uppercase tracking-widest">${escapeHtml(fileObj.size)} • ${escapeHtml(config.label)}</p>
        </div>
      </div>
      <a href="${escapeHtml(fileObj.url)}" target="_blank" rel="noopener noreferrer"
        class="text-slate-300 hover:text-slate-900 transition-colors">
        <i class="fa fa-external-link text-xs"></i>
      </a>
    `;

    previewZone.prepend(card);
  },

  notifyUser(msg, type) {
    console.log(`[${String(type || 'info').toUpperCase()}] ${msg}`);

    if (type === 'error') {
      notifyModal('Upload error', msg);
      return;
    }
    if (type === 'warning') {
      notifyModal('Upload warning', msg);
      return;
    }

    notifyModal('Notice', msg);
  }
};
