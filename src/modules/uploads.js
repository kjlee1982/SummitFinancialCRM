/**
 * src/modules/uploads.js
 * Minimal uploads view that wires into uploadManager dropzone + simple list.
 */

import { stateManager } from '../state.js';
import { uploadManager } from '../modules/uploads.js';
import { escapeHtml } from '../utils/formatters.js';

function getUploadsForContext(ctx) {
  const s = stateManager.get();
  const all = Array.isArray(s.uploads) ? s.uploads : [];
  return all.filter(u => {
    const m = u?.meta || {};
    return (m.dealId || null) === (ctx.dealId || null)
      && (m.propertyId || null) === (ctx.propertyId || null)
      && (m.investorId || null) === (ctx.investorId || null)
      && (m.llcId || null) === (ctx.llcId || null);
  });
}

function renderList(ctx) {
  const host = document.getElementById('uploads-list');
  if (!host) return;

  const items = getUploadsForContext(ctx);
  if (!items.length) {
    host.innerHTML = `<div class="text-sm text-slate-500">No uploads yet for this context.</div>`;
    return;
  }

  host.innerHTML = `
    <div class="space-y-2">
      ${items.map(u => `
        <div class="p-3 bg-white rounded-xl border border-slate-200 flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="font-bold text-slate-900 truncate">${escapeHtml(u.name || 'Untitled')}</div>
            <div class="text-xs text-slate-500 mt-0.5">
              ${escapeHtml(u.type || '')} ${u.size ? `• ${Math.round(u.size/1024)} KB` : ''} ${u.created_at ? `• ${new Date(u.created_at).toLocaleString()}` : ''}
            </div>
            ${u.url ? `<a class="text-xs text-blue-600 hover:underline" href="${escapeHtml(u.url)}" target="_blank" rel="noopener noreferrer">Open</a>` : ''}
          </div>
          <button class="px-3 py-1.5 rounded-lg text-sm font-bold text-red-600 hover:bg-red-50" data-action="upload-delete" data-id="${escapeHtml(u.id)}">
            Delete
          </button>
        </div>
      `).join('')}
    </div>
  `;
}

function ensureBinds() {
  if (ensureBinds._bound) return;
  ensureBinds._bound = true;

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="upload-delete"]');
    if (!btn) return;

    const id = btn.dataset.id;
    if (!id) return;

    // keep it simple (you can swap to modalManager danger confirm later)
    if (!confirm('Delete this upload?')) return;

    uploadManager.deleteUpload(id);
    // Re-render current view (uploads render is cheap)
    uploads.render();
  });
}

export const uploads = {
  render() {
    ensureBinds();

    const host = document.getElementById('view-uploads');
    if (!host) return;

    // infer a default context (deal/property/llc/etc) from current app state
    const ctx = uploadManager.inferContextFromState();

    host.innerHTML = `
      <div class="p-6 md:p-8 max-w-7xl mx-auto">
        <div class="flex items-end justify-between gap-4 mb-6">
          <div>
            <div class="text-3xl font-black tracking-tighter text-slate-900">Uploads</div>
            <div class="text-sm text-slate-500 mt-1">Upload and organize documents for deals, properties, investors, and entities.</div>
          </div>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="bg-white rounded-2xl border border-slate-200 p-5">
            <div class="font-bold text-slate-900 mb-2">Drop files</div>
            <div id="uploads-dropzone"></div>
            <div class="text-xs text-slate-500 mt-2">
              Context: ${escapeHtml(uploadManager.contextLabel(ctx))}
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-slate-200 p-5">
            <div class="font-bold text-slate-900 mb-3">Files</div>
            <div id="uploads-list"></div>
          </div>
        </div>
      </div>
    `;

    // render dropzone + list
    uploadManager.renderDropzone('uploads-dropzone', ctx);
    renderList(ctx);
  }
};
