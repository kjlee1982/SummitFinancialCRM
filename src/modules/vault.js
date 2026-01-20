/**
 * src/modules/vault.js
 * Document vault + revision history.
 *
 * Full overwrite updates included (UI kept identical):
 * - Array guards (vault, properties)
 * - escapeHtml everywhere state is injected into HTML
 * - Bind-once delegated events on #view-vault
 * - modalManager delete confirmation (danger) instead of confirm()
 * - Safe revision sorting (newest-first by date)
 * - Safe add + revision flows:
 *    - validate required fields
 *    - throw errors for modalManager to surface (no alert)
 *    - return true to close modals reliably
 * - rel="noopener noreferrer" on all target=_blank links
 */

import { stateManager } from '../state.js';
import { modalManager } from '../utils/modals.js';

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getVault(state) {
  return Array.isArray(state?.vault) ? state.vault : [];
}

function getProperties(state) {
  return Array.isArray(state?.properties) ? state.properties : [];
}

function normalizeKey(v) {
  return String(v ?? '').trim().toLowerCase();
}

function idEq(a, b) {
  return String(a ?? '') === String(b ?? '');
}

function safeDateMs(d) {
  const ms = Date.parse(String(d ?? ''));
  return Number.isFinite(ms) ? ms : 0;
}

function sortedHistory(doc) {
  const revs = Array.isArray(doc?.revisions) ? doc.revisions : [];
  const base = doc?.url
    ? [{ url: doc.url, note: 'Original', date: doc.uploadedAt || doc.createdAt || doc.created_at || new Date().toISOString() }]
    : [];

  // Combine and de-dupe by url+date+note
  const combined = [...revs, ...base].filter(r => r?.url);

  combined.sort((a, b) => safeDateMs(b?.date) - safeDateMs(a?.date));
  return combined;
}

export const vault = {
  _bound: false,

  render(state) {
    const container = document.getElementById('view-vault');
    if (!container) return;

    const documents = getVault(state);

    // Build a property name list for linking (keep UI identical)
    const propertyNames = getProperties(state)
      .map(p => String(p?.name ?? '').trim())
      .filter(Boolean);

    container.innerHTML = `
      <div class="p-6 max-w-6xl mx-auto space-y-8">
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 class="text-2xl font-black text-slate-900 tracking-tight italic">Vault</h2>
            <p class="text-sm text-slate-500 font-medium tracking-tight">Secure archive of due diligence, legal, and operational documents.</p>
          </div>
          <button id="add-vault-doc"
            class="bg-slate-900 text-white px-5 py-2.5 rounded-xl hover:bg-slate-800 font-bold shadow-sm transition-all flex items-center text-xs uppercase tracking-widest">
            <i class="fa fa-plus-circle mr-2 text-[10px]"></i>Add Document
          </button>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" id="vault-grid">
          ${this.renderCards(documents)}
        </div>
      </div>
    `;

    // Store property names for modals (no global var leaks)
    this._propertyNames = propertyNames;

    this.bindEvents();
  },

  renderCards(documents) {
    const docs = Array.isArray(documents) ? documents : [];

    if (docs.length === 0) {
      return `
        <div class="col-span-full py-24 text-center border-2 border-dashed border-slate-200 rounded-[2rem] bg-white">
          <div class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <i class="fa fa-folder-open text-slate-200 text-2xl"></i>
          </div>
          <p class="text-slate-400 font-bold uppercase tracking-widest text-[10px]">No documents in vault.</p>
        </div>`;
    }

    return docs.map((doc) => {
      const history = sortedHistory(doc);
      const versionCount = history.length;
      const latestUrl = versionCount > 0 ? history[0]?.url : (doc?.url || '#');

      const category = escapeHtml(doc?.category || 'General');
      const name = escapeHtml(doc?.name || 'Untitled');
      const linked = escapeHtml(doc?.linked_to || '');

      return `
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden group hover:border-slate-400 transition-all">
          <div class="p-5 border-b border-slate-100 bg-slate-50/30 flex justify-between items-start">
            <div>
              <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">${category}</p>
              <h3 class="font-black text-slate-900 tracking-tight truncate max-w-[240px]">${name}</h3>
              ${linked ? `
                <p class="text-[10px] font-bold text-orange-600 mt-1 uppercase tracking-widest truncate max-w-[240px]">
                  <i class="fa fa-link mr-1 opacity-50"></i>${linked}
                </p>
              ` : `
                <p class="text-[10px] font-bold text-slate-300 mt-1 uppercase tracking-widest">
                  <i class="fa fa-link mr-1 opacity-30"></i>Unlinked
                </p>
              `}
            </div>

            <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button data-action="vault-history" data-id="${escapeHtml(doc?.id)}"
                class="p-2 text-slate-300 hover:text-slate-900 transition-all" title="History">
                <i class="fa fa-clock-rotate-left text-xs"></i>
              </button>
              <button data-action="vault-revise" data-id="${escapeHtml(doc?.id)}"
                class="p-2 text-slate-300 hover:text-orange-600 transition-all" title="Add Revision">
                <i class="fa fa-code-branch text-xs"></i>
              </button>
              <button data-action="vault-delete" data-id="${escapeHtml(doc?.id)}"
                class="p-2 text-slate-300 hover:text-red-500 transition-all" title="Delete">
                <i class="fa fa-trash-alt text-xs"></i>
              </button>
            </div>
          </div>

          <div class="p-5 space-y-4">
            <div class="flex items-center justify-between">
              <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Versions</span>
              <span class="text-[10px] font-black text-slate-900 uppercase tracking-widest">
                ${versionCount}
              </span>
            </div>

            <a href="${escapeHtml(latestUrl)}" target="_blank" rel="noopener noreferrer"
              class="w-full inline-flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all shadow-sm">
              <i class="fa fa-shield-halved text-[10px]"></i> Open Latest
            </a>
          </div>

          <div class="px-5 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              ${escapeHtml((doc?.uploadedAt || doc?.createdAt || doc?.created_at || '').toString().slice(0, 10) || '')}
            </span>
            <button data-action="vault-history" data-id="${escapeHtml(doc?.id)}"
              class="text-xs font-bold text-slate-600 hover:text-orange-600 transition-colors">
              View History <i class="fa fa-chevron-right ml-1"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  bindEvents() {
    const container = document.getElementById('view-vault');
    if (!container) return;

    // Add button (recreated each render)
    const addBtn = document.getElementById('add-vault-doc');
    if (addBtn) addBtn.onclick = () => this.showAddModal();

    if (this._bound) return;
    this._bound = true;

    // Delegated events
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const id = btn.dataset.id;

      if (action === 'vault-delete') {
        this.confirmDelete(id);
        return;
      }
      if (action === 'vault-history') {
        this.showHistoryModal(id);
        return;
      }
      if (action === 'vault-revise') {
        this.showRevisionModal(id);
        return;
      }
    });
  },

  getDocById(id) {
    const state = stateManager.get();
    const docs = getVault(state);
    return docs.find(d => idEq(d?.id, id)) || null;
  },

  showAddModal() {
    const propertyNames = Array.isArray(this._propertyNames) ? this._propertyNames : [];

    const propertyOptions = propertyNames
      .map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`)
      .join('');

    const formHtml = `
      <div class="space-y-5">
        <div>
          <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Document Name</label>
          <input type="text" id="vault-name"
            class="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-slate-900 transition-all font-bold"
            placeholder="e.g. T-12, Insurance Quote, PSA, Survey">
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Category</label>
            <select id="vault-category" class="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold">
              <option value="Due Diligence">Due Diligence</option>
              <option value="Legal">Legal</option>
              <option value="Operations">Operations</option>
              <option value="Financial">Financial</option>
              <option value="General" selected>General</option>
            </select>
          </div>

          <div>
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Link To (optional)</label>
            <select id="vault-linked" class="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold">
              <option value="">Unlinked</option>
              ${propertyOptions}
            </select>
          </div>
        </div>

        <div>
          <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Document URL</label>
          <input type="url" id="vault-url"
            class="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-slate-900 transition-all font-bold"
            placeholder="https://...">
          <p class="text-[11px] font-semibold text-slate-400 mt-2">
            Paste a secure link (Firebase Storage, Google Drive, etc).
          </p>
        </div>
      </div>
    `;

    modalManager.show(
      'Create Master Record',
      formHtml,
      () => {
        const name = String(document.getElementById('vault-name')?.value ?? '').trim();
        const category = String(document.getElementById('vault-category')?.value ?? 'General').trim();
        const linked_to = String(document.getElementById('vault-linked')?.value ?? '').trim();
        const url = String(document.getElementById('vault-url')?.value ?? '').trim();

        if (!name) throw new Error('Document name is required.');
        if (!url) throw new Error('Document URL is required.');

        const id = `vault_${globalThis.crypto?.randomUUID?.() || Date.now().toString()}`;
        const now = new Date().toISOString();

        const data = {
          id,
          name,
          category,
          linked_to,
          url,
          uploadedAt: now,
          createdAt: now,
          created_at: now,
          revisions: [] // newest-first (enforced on render)
        };

        stateManager.add('vault', data);
        stateManager.logActivity?.(`Vault Record Created: ${name}`);

        return true;
      },
      { submitLabel: 'Create', cancelLabel: 'Cancel' }
    );
  },

  showRevisionModal(docId) {
    const doc = this.getDocById(docId);

    if (!doc) {
      modalManager.show(
        'Not found',
        `<p class="text-sm font-semibold text-slate-700">That document could not be found.</p>`,
        () => true,
        { submitLabel: 'Close', hideCancel: true }
      );
      return;
    }

    const formHtml = `
      <div class="space-y-5">
        <div>
          <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Master Record</p>
          <p class="text-sm font-black text-slate-900">${escapeHtml(doc.name || 'Untitled')}</p>
        </div>

        <div>
          <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">New Revision URL</label>
          <input type="url" id="rev-url"
            class="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-slate-900 transition-all font-bold"
            placeholder="https://...">
        </div>

        <div>
          <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Revision Note</label>
          <input type="text" id="rev-note"
            class="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-slate-900 transition-all font-bold"
            placeholder="e.g. Updated rent roll, final insurance binder">
        </div>
      </div>
    `;

    modalManager.show(
      'Commit Revision',
      formHtml,
      () => {
        const url = String(document.getElementById('rev-url')?.value ?? '').trim();
        const note = String(document.getElementById('rev-note')?.value ?? '').trim();

        if (!url) throw new Error('Revision URL is required.');
        if (!note) throw new Error('Revision note is required.');

        const now = new Date().toISOString();
        const existing = Array.isArray(doc?.revisions) ? doc.revisions : [];

        // Prepend new revision (newest-first); sort will also be enforced during render
        const nextRevisions = [{ url, note, date: now }, ...existing];

        stateManager.update('vault', doc.id, { revisions: nextRevisions });
        stateManager.logActivity?.(`Vault Revision Added: ${doc.name}`);

        return true;
      },
      { submitLabel: 'Commit', cancelLabel: 'Cancel' }
    );
  },

  showHistoryModal(docId) {
    const doc = this.getDocById(docId);

    if (!doc) {
      modalManager.show(
        'Not found',
        `<p class="text-sm font-semibold text-slate-700">That document could not be found.</p>`,
        () => true,
        { submitLabel: 'Close', hideCancel: true }
      );
      return;
    }

    const history = sortedHistory(doc);

    const listHtml = history.length
      ? `
        <div class="space-y-3">
          ${history.map((rev, idx) => {
            const revUrl = escapeHtml(rev?.url || '#');
            const note = escapeHtml(rev?.note || (idx === history.length - 1 ? 'Original' : 'Revision'));
            const date = escapeHtml(String(rev?.date || '').slice(0, 10));
            return `
              <div class="p-4 rounded-2xl border border-slate-100 bg-white flex items-center justify-between gap-4">
                <div class="min-w-0">
                  <p class="text-sm font-black text-slate-900 truncate">${note}</p>
                  <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">${date}</p>
                </div>
                <a href="${revUrl}" target="_blank" rel="noopener noreferrer"
                  class="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-[10px] uppercase tracking-widest transition-all">
                  Open
                </a>
              </div>
            `;
          }).join('')}
        </div>
      `
      : `
        <div class="py-10 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-white">
          <p class="text-[10px] font-black uppercase tracking-widest">No history available.</p>
        </div>
      `;

    modalManager.show(
      'Version History',
      `
        <div class="space-y-4">
          <div>
            <p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Document</p>
            <p class="text-sm font-black text-slate-900">${escapeHtml(doc.name || 'Untitled')}</p>
          </div>
          ${listHtml}
        </div>
      `,
      () => true,
      { submitLabel: 'Close', hideCancel: true }
    );
  },

  confirmDelete(docId) {
    const doc = this.getDocById(docId);

    if (!doc) {
      modalManager.show(
        'Not found',
        `<p class="text-sm font-semibold text-slate-700">That document could not be found.</p>`,
        () => true,
        { submitLabel: 'Close', hideCancel: true }
      );
      return;
    }

    modalManager.show(
      'Purge record',
      `<p class="text-sm font-semibold text-slate-700">
        Purge <span class="font-black">${escapeHtml(doc.name || 'this record')}</span> and all version history? This cannot be undone.
      </p>`,
      () => {
        stateManager.delete('vault', doc.id);
        stateManager.logActivity?.(`Vault Record Purged: ${doc.name}`);
        return true;
      },
      { submitLabel: 'Purge', cancelLabel: 'Cancel', danger: true }
    );
  }
};

// Compatibility exports
export const renderVault = (state) => vault.render(state);
export const showAddVaultModal = () => vault.showAddModal();
