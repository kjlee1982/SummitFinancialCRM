/**
 * src/modules/llcs.js
 * Manages Legal Entities, LLC structures, and ownership mapping.
 *
 * Overwrite updates included:
 * - Fix broken export (LLC -> llcs)
 * - Array guards for llcs/properties
 * - Escape HTML output
 * - Case-safe + id-safe property ownership matching
 * - Event delegation (single handler)
 * - Delete uses modalManager (danger) instead of confirm()
 * - Add "Assign Property" action in LLC card footer:
 *    - dropdown of properties
 *    - sets property.llc_id = llc.id
 *    - also sets property.owning_llc = llc.name for backward compatibility
 * - Adds created_at/createdAt alongside registeredAt for consistency
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

function normalizeStr(v) {
  return String(v ?? '').trim();
}

function normalizeKey(v) {
  return normalizeStr(v).toLowerCase();
}

function idEq(a, b) {
  return String(a ?? '') === String(b ?? '');
}

function getEntities(state) {
  return Array.isArray(state?.llcs) ? state.llcs : [];
}

function getProperties(state) {
  return Array.isArray(state?.properties) ? state.properties : [];
}

export const llcs = {
  _bound: false,
  _lastState: null,

  /**
   * Main render function called by the router
   */
  render(state) {
    const container = document.getElementById('view-llcs');
    if (!container) return;

    this._lastState = state;

    const entities = getEntities(state);
    const properties = getProperties(state);

    container.innerHTML = `
      <div class="p-6">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 class="text-2xl font-black text-slate-900">Legal Entities</h2>
            <p class="text-sm text-slate-500 font-medium">
              Managing ${entities.length} Special Purpose Vehicles (SPVs) for asset titling.
            </p>
          </div>
          <button id="add-llc-btn" class="bg-slate-900 text-white px-5 py-2.5 rounded-lg hover:bg-slate-800 font-bold shadow-sm transition-all flex items-center text-sm">
            <i class="fa fa-file-shield mr-2 text-[10px]"></i>Register New LLC
          </button>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-2 gap-6" id="llc-grid">
          ${this.renderLLCCards(entities, properties)}
        </div>
      </div>
    `;

    this.bindEvents();
  },

  /**
   * Case-safe and id-safe property ownership check.
   * Supports:
   *  - property.llc_id === llc.id (string-safe)
   *  - property.owning_llc matches llc.name (case/trim-safe)
   */
  isPropertyOwnedByLLC(p, llc) {
    const pLlcId = p?.llc_id;
    const llcId = llc?.id;

    if (idEq(pLlcId, llcId) && String(pLlcId ?? '') !== '') return true;

    const owning = normalizeKey(p?.owning_llc);
    const llcName = normalizeKey(llc?.name);

    if (owning && llcName && owning === llcName) return true;

    return false;
  },

  renderLLCCards(entitiesList, allProperties) {
    if (!entitiesList || entitiesList.length === 0) {
      return `
        <div class="col-span-full py-20 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-white">
          <i class="fa fa-folder-open text-4xl mb-4 opacity-20"></i>
          <p class="font-bold">No legal entities registered.</p>
          <p class="text-sm">SPVs are required to hold title for real estate assets.</p>
        </div>`;
    }

    return entitiesList.map(llc => {
      const ownedProperties = (allProperties || []).filter(p => this.isPropertyOwnedByLLC(p, llc));

      const name = escapeHtml(llc?.name || 'Unnamed LLC');
      const ein = escapeHtml(llc?.ein || 'PENDING');
      const stateOfInc = escapeHtml(llc?.state_of_inc || 'DE');
      const manager = escapeHtml(llc?.manager || 'Corporate GP');

      // Status badge (future-proof; defaults to Good Standing)
      const statusRaw = normalizeKey(llc?.status);
      const statusLabel = statusRaw ? statusRaw.replaceAll('_', ' ') : 'good standing';

      const statusUi = (() => {
        // Keep your current "GOOD STANDING" look unless status is explicitly something else
        if (!statusRaw || statusRaw === 'active' || statusRaw === 'good standing' || statusRaw === 'good_standing') {
          return `
            <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center">
              <span class="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
              GOOD STANDING
            </span>
          `;
        }

        if (statusRaw === 'dormant') {
          return `
            <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-50 text-slate-600 border border-slate-200 flex items-center">
              <span class="h-1.5 w-1.5 rounded-full bg-slate-400 mr-1.5"></span>
              DORMANT
            </span>
          `;
        }

        if (statusRaw === 'pending') {
          return `
            <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-100 flex items-center">
              <span class="h-1.5 w-1.5 rounded-full bg-amber-500 mr-1.5"></span>
              PENDING
            </span>
          `;
        }

        if (statusRaw === 'dissolved' || statusRaw === 'inactive') {
          return `
            <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-50 text-red-700 border border-red-100 flex items-center">
              <span class="h-1.5 w-1.5 rounded-full bg-red-500 mr-1.5"></span>
              ${escapeHtml(statusLabel.toUpperCase())}
            </span>
          `;
        }

        // Unknown status: neutral
        return `
          <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-50 text-slate-600 border border-slate-200 flex items-center">
            <span class="h-1.5 w-1.5 rounded-full bg-slate-400 mr-1.5"></span>
            ${escapeHtml(statusLabel.toUpperCase())}
          </span>
        `;
      })();

      return `
        <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:border-slate-400 transition-all group">
          <div class="p-5 border-b border-slate-100 flex justify-between items-start bg-slate-50/50">
            <div>
              <h3 class="font-black text-slate-900 uppercase tracking-tight">${name}</h3>
              <div class="flex items-center gap-3 mt-1">
                <p class="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  EIN: <span class="text-slate-900">${ein}</span>
                </p>
                <span class="text-slate-300">|</span>
                <p class="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                  Jurisdiction: <span class="text-slate-900">${stateOfInc}</span>
                </p>
              </div>
            </div>
            <div class="flex flex-col items-end gap-2">
              ${statusUi}
              <button data-action="llc-delete" data-id="${escapeHtml(llc?.id)}" class="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition-all">
                <i class="fa fa-trash-alt text-[10px]"></i>
              </button>
            </div>
          </div>

          <div class="p-5">
            <h4 class="text-[10px] font-black text-slate-400 uppercase mb-3 tracking-[0.15em]">Titled Portfolio Assets</h4>
            <div class="space-y-2">
              ${ownedProperties.length > 0 ? ownedProperties.map(p => `
                <div class="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100 hover:bg-white hover:shadow-sm transition-all cursor-default">
                  <div class="flex items-center text-xs font-bold text-slate-700">
                    <div class="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center mr-3 text-[10px]">
                      <i class="fa fa-building text-slate-400"></i>
                    </div>
                    ${escapeHtml(p?.name || 'Unnamed Property')}
                  </div>
                  <span class="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-black uppercase tracking-tighter">${escapeHtml(p?.units ?? 0)} UNITS</span>
                </div>
              `).join('') : `
                <div class="py-6 text-center border border-dashed border-slate-100 rounded-xl">
                  <p class="text-[10px] text-slate-400 font-bold uppercase italic">No assets currently titled to this entity</p>
                </div>
              `}
            </div>
          </div>

          <div class="px-5 py-4 bg-slate-50 border-t border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div class="text-[11px] text-slate-500">
              Manager: <span class="font-black text-slate-900 uppercase">${manager}</span>
            </div>
            <div class="flex gap-3">
              <button class="flex items-center text-[10px] font-black text-slate-600 uppercase bg-white border border-slate-200 px-3 py-1.5 rounded-lg hover:border-orange-500 hover:text-orange-600 transition-all shadow-sm">
                <i class="fa fa-file-contract mr-2"></i> Documents
              </button>

              <button class="flex items-center text-[10px] font-black text-slate-600 uppercase bg-white border border-slate-200 px-3 py-1.5 rounded-lg hover:border-orange-500 hover:text-orange-600 transition-all shadow-sm">
                <i class="fa fa-fingerprint mr-2"></i> Tax ID
              </button>

              <!-- NEW: Assign Property action -->
              <button data-action="llc-assign-property" data-id="${escapeHtml(llc?.id)}"
                class="flex items-center text-[10px] font-black text-slate-600 uppercase bg-white border border-slate-200 px-3 py-1.5 rounded-lg hover:border-orange-500 hover:text-orange-600 transition-all shadow-sm">
                <i class="fa fa-link mr-2"></i> Assign Property
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  bindEvents() {
    const container = document.getElementById('view-llcs');
    if (!container) return;

    // Add button (rebuilt each render)
    const addBtn = document.getElementById('add-llc-btn');
    if (addBtn) addBtn.onclick = () => this.showAddLLCModal();

    // Delegated click handling (bind once)
    if (this._bound) return;
    this._bound = true;

    container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const id = btn.dataset.id;

      if (action === 'llc-delete') {
        this.confirmDelete(id);
        return;
      }

      if (action === 'llc-assign-property') {
        this.showAssignPropertyModal(id);
        return;
      }
    });
  },

  confirmDelete(id) {
    const entities = getEntities(this._lastState);
    const llc = entities.find(x => idEq(x?.id, id));
    const label = llc?.name ? `“${llc.name}”` : 'this entity';

    modalManager.show(
      'De-register entity',
      `<p class="text-sm font-semibold text-slate-700">
        De-register ${escapeHtml(label)}?
        <br><span class="text-slate-500">Ensure no assets are titled to this LLC before proceeding.</span>
      </p>`,
      () => {
        stateManager.delete('llcs', id);
        return true;
      },
      { submitLabel: 'De-register', cancelLabel: 'Cancel', danger: true }
    );
  },

  showAssignPropertyModal(llcId) {
    const entities = getEntities(this._lastState);
    const properties = getProperties(this._lastState);

    const llc = entities.find(x => idEq(x?.id, llcId));
    if (!llc) {
      modalManager.show(
        'Entity not found',
        `<p class="text-sm font-semibold text-slate-700">That LLC could not be found.</p>`,
        () => true,
        { submitLabel: 'Close', hideCancel: true }
      );
      return;
    }

    // Properties that are NOT already assigned to this LLC
    const available = properties.filter(p => !this.isPropertyOwnedByLLC(p, llc));

    const optionsHtml = available.length
      ? available
          .map((p) => {
            const label = `${p?.name || 'Unnamed Property'}${p?.units ? ` • ${p.units} units` : ''}`;
            return `<option value="${escapeHtml(p?.id)}">${escapeHtml(label)}</option>`;
          })
          .join('')
      : `<option value="">No unassigned properties available</option>`;

    const formHtml = `
      <div class="space-y-4">
        <p class="text-sm font-semibold text-slate-700">
          Assign a property to <span class="font-black">${escapeHtml(llc?.name || 'this LLC')}</span>.
        </p>

        <div>
          <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Property</label>
          <select id="llc-assign-property-id"
            class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 transition-all">
            ${optionsHtml}
          </select>
        </div>

        <div class="p-4 bg-orange-50 rounded-xl border border-orange-100">
          <p class="text-[10px] text-orange-700 font-bold leading-relaxed italic">
            <i class="fa fa-info-circle mr-1"></i>
            This will set <span class="font-black">property.llc_id</span> and also update <span class="font-black">property.owning_llc</span> for backward compatibility.
          </p>
        </div>
      </div>
    `;

    modalManager.show(
      'Assign Property',
      formHtml,
      () => {
        const sel = document.getElementById('llc-assign-property-id');
        const propertyId = sel?.value ? String(sel.value) : '';

        if (!propertyId) throw new Error('Please select a property.');

        // Update property linkage:
        // - llc_id is the canonical link
        // - owning_llc is kept in sync for legacy matching / readability
        stateManager.update('properties', propertyId, {
          llc_id: llc.id,
          owning_llc: llc.name
        });

        return true;
      },
      { submitLabel: 'Assign', cancelLabel: 'Cancel' }
    );
  },

  showAddLLCModal() {
    const formHtml = `
      <div class="space-y-5">
        <div>
          <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Entity Full Legal Name</label>
          <input type="text" id="llc-name"
            class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-slate-900 transition-all"
            placeholder="e.g. 123 Main St Holdings, LLC">
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">State of Org.</label>
            <select id="llc-state" class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none">
              <option value="DE">Delaware</option>
              <option value="TX">Texas</option>
              <option value="FL">Florida</option>
              <option value="WY">Wyoming</option>
              <option value="NV">Nevada</option>
            </select>
          </div>
          <div>
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">EIN / Tax ID</label>
            <input type="text" id="llc-ein"
              class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
              placeholder="00-0000000">
          </div>
        </div>

        <div>
          <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Designated Managing Member</label>
          <input type="text" id="llc-manager"
            class="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl outline-none"
            placeholder="e.g. Summit Capital Management, LLC">
        </div>

        <div class="p-4 bg-orange-50 rounded-xl border border-orange-100">
          <p class="text-[10px] text-orange-700 font-bold leading-relaxed italic">
            <i class="fa fa-info-circle mr-1"></i> Ensure the legal name exactly matches the Articles of Organization filed with the Secretary of State.
          </p>
        </div>
      </div>
    `;

    modalManager.show(
      "Register Legal Entity",
      formHtml,
      () => {
        const name = normalizeStr(document.getElementById('llc-name')?.value);
        const state_of_inc = normalizeStr(document.getElementById('llc-state')?.value) || 'DE';
        const ein = normalizeStr(document.getElementById('llc-ein')?.value);
        const manager = normalizeStr(document.getElementById('llc-manager')?.value);

        const now = new Date().toISOString();

        const data = {
          name,
          state_of_inc,
          ein,
          manager,

          // Keep old field for backward compatibility
          registeredAt: now,

          // Add consistent timestamps
          created_at: now,
          createdAt: now
        };

        if (!data.name) throw new Error('Entity name is required.');

        stateManager.add('llcs', data);
        return true;
      },
      { submitLabel: 'Register', cancelLabel: 'Cancel' }
    );
  }
};

// Compatibility exports
export const showAddLLCModal = () => llcs.showAddLLCModal();
export const renderLLCs = (state) => llcs.render(state);

// (Removed the broken export that referenced "LLC")
