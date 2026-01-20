/**
 * src/modules/projects.js
 * CapEx / Project Tracker
 *
 * Full overwrite updates included:
 * - Bind-once delegated events on #view-projects
 * - Delete uses modalManager (danger) instead of confirm()
 * - Fully working "Manage Spend" (edit) modal
 * - Array guards + safe percent math (no divide-by-zero)
 * - Modal save callbacks return true (close reliably)
 * - escapeHtml on displayed fields (prevents layout break / injection)
 *
 * Compatibility:
 * - Exports `projects` (module object) and named helpers `renderProjects`, `showAddProjectModal`
 */

import { stateManager } from '../state.js';
import { formatters } from '../utils/formatters.js';
import { modalManager } from '../utils/modals.js';

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function toNumber(v, fallback = 0) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n, min, max) {
  const x = Number(n);
  if (!Number.isFinite(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function getProjects(state) {
  return Array.isArray(state?.projects) ? state.projects : [];
}

function getProperties(state) {
  return Array.isArray(state?.properties) ? state.properties : [];
}

export const projects = {
  _bound: false,
  _lastState: null,

  render(state) {
    const container = document.getElementById('view-projects');
    if (!container) return;

    this._lastState = state;

    const projectList = getProjects(state);

    const totalBudget = projectList.reduce((sum, p) => sum + toNumber(p?.budget, 0), 0);
    const totalSpent = projectList.reduce((sum, p) => sum + toNumber(p?.spent, 0), 0);
    const overallPct = totalBudget > 0 ? clamp((totalSpent / totalBudget) * 100, 0, 100) : 0;

    container.innerHTML = `
      <div class="p-6">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 class="text-2xl font-bold text-gray-900">Project Tracker</h2>
            <p class="text-sm text-gray-500 font-medium">
              ${projectList.length} active projects • Budget: ${formatters.dollars(totalBudget)} • Spent: ${formatters.dollars(totalSpent)}
            </p>
          </div>

          <button id="add-project-btn"
            class="bg-slate-900 text-white px-5 py-2.5 rounded-lg hover:bg-slate-800 font-bold shadow-sm transition-all flex items-center text-sm">
            <i class="fa fa-plus mr-2"></i>Add Project
          </button>
        </div>

        <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Portfolio CapEx Progress</p>
              <p class="text-sm font-bold text-gray-900 mt-1">
                ${formatters.dollars(totalSpent)} / ${formatters.dollars(totalBudget)}
              </p>
            </div>
            <div class="text-right">
              <p class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Completion</p>
              <p class="text-2xl font-black text-slate-900">${Math.round(overallPct)}%</p>
            </div>
          </div>
          <div class="w-full bg-gray-100 h-2 rounded-full overflow-hidden mt-4">
            <div class="bg-orange-500 h-full" style="width:${overallPct}%"></div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
          ${this.renderProjectCards(projectList)}
        </div>
      </div>
    `;

    this.bindEvents();
  },

  renderProjectCards(projectList) {
    if (!projectList || projectList.length === 0) {
      return `
        <div class="col-span-full py-20 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-white">
          <i class="fa fa-screwdriver-wrench text-4xl mb-3 opacity-20"></i>
          <p>No projects yet.</p>
        </div>
      `;
    }

    return projectList.map((proj) => {
      const id = escapeHtml(proj?.id);
      const name = escapeHtml(proj?.name || 'Untitled Project');
      const property = escapeHtml(proj?.property || 'Unassigned');
      const status = escapeHtml(proj?.status || 'Active');
      const lead = escapeHtml(proj?.lead || 'Unassigned');

      const budget = toNumber(proj?.budget, 0);
      const spent = toNumber(proj?.spent, 0);
      const variance = budget - spent;

      const percentComplete =
        normalizeKey(proj?.status) === 'completed'
          ? 100
          : clamp(toNumber(proj?.percent_complete, 0), 0, 100);

      const spendPct = budget > 0 ? clamp((spent / budget) * 100, 0, 100) : 0;

      return `
        <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow group">
          <div class="p-5">
            <div class="flex justify-between items-start mb-3">
              <span class="px-2 py-1 rounded text-[10px] font-bold uppercase ${this.getStatusClass(status)}">
                ${status}
              </span>

              <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button data-action="project-edit" data-id="${id}"
                  class="text-gray-400 hover:text-slate-700" title="Manage Spend">
                  <i class="fa fa-pen text-xs"></i>
                </button>
                <button data-action="project-delete" data-id="${id}"
                  class="text-gray-400 hover:text-red-500" title="Cancel Project">
                  <i class="fa fa-trash text-xs"></i>
                </button>
              </div>
            </div>

            <h3 class="font-bold text-gray-900 text-lg mb-1 truncate">${name}</h3>
            <p class="text-xs text-gray-500 mb-4 truncate">
              <i class="fa fa-building mr-1"></i>${property}
            </p>

            <div class="space-y-3">
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-500 font-semibold">Budget</span>
                <span class="font-black text-gray-900">${formatters.dollars(budget)}</span>
              </div>
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-500 font-semibold">Spent</span>
                <span class="font-black text-gray-900">${formatters.dollars(spent)}</span>
              </div>
              <div class="flex items-center justify-between text-sm">
                <span class="text-gray-500 font-semibold">Variance</span>
                <span class="font-black ${variance >= 0 ? 'text-emerald-600' : 'text-red-600'}">
                  ${variance >= 0 ? '' : '('}${formatters.dollars(Math.abs(variance))}${variance >= 0 ? '' : ')'}
                </span>
              </div>
            </div>

            <div class="mt-5">
              <div class="flex items-center justify-between mb-2">
                <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Progress</span>
                <span class="text-[10px] font-black text-slate-700 uppercase">${Math.round(percentComplete)}%</span>
              </div>
              <div class="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                <div class="bg-slate-900 h-full" style="width:${percentComplete}%"></div>
              </div>

              <div class="flex items-center justify-between mt-3">
                <span class="text-[10px] font-black text-gray-400 uppercase tracking-widest">Spend</span>
                <span class="text-[10px] font-black text-orange-600 uppercase">${Math.round(spendPct)}%</span>
              </div>
              <div class="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden mt-1">
                <div class="bg-orange-500 h-full" style="width:${spendPct}%"></div>
              </div>
            </div>
          </div>

          <div class="bg-gray-50 px-5 py-3 flex justify-between items-center">
            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Lead: ${lead}</span>
            <button data-action="project-edit" data-id="${id}"
              class="text-xs font-bold text-slate-600 hover:text-orange-600 transition-colors">
              Manage Spend <i class="fa fa-chevron-right ml-1"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  bindEvents() {
    const container = document.getElementById('view-projects');
    if (!container) return;

    const addBtn = document.getElementById('add-project-btn');
    if (addBtn) addBtn.onclick = () => this.showAddProjectModal();

    if (this._bound) return;
    this._bound = true;

    container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const id = btn.dataset.id;

      if (action === 'project-delete') {
        this.confirmDelete(id);
        return;
      }

      if (action === 'project-edit') {
        this.openEditById(id);
      }
    });
  },

  confirmDelete(id) {
    const list = getProjects(this._lastState);
    const proj = list.find((p) => String(p?.id) === String(id));
    const label = proj?.name ? `“${proj.name}”` : 'this project';

    modalManager.show(
      'Cancel project',
      `<p class="text-sm font-semibold text-slate-700">Cancel ${escapeHtml(label)}? This cannot be undone.</p>`,
      () => {
        stateManager.delete('projects', id);
        return true;
      },
      { submitLabel: 'Cancel Project', cancelLabel: 'Keep', danger: true }
    );
  },

  openEditById(id) {
    const list = getProjects(this._lastState);
    const proj = list.find((p) => String(p?.id) === String(id));

    if (!proj) {
      modalManager.show(
        'Project not found',
        `<p class="text-sm font-semibold text-slate-700">That project could not be found. It may have been deleted or not synced yet.</p>`,
        () => true,
        { submitLabel: 'Close', hideCancel: true }
      );
      return;
    }

    this.showEditProjectModal(proj);
  },

  showAddProjectModal() {
    const props = getProperties(this._lastState);

    const formHtml = `
      <div class="space-y-5">
        <div>
          <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Project Name</label>
          <input type="text" id="proj-name"
            class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
            placeholder="e.g. Unit Turns - Phase 1">
        </div>

        <div>
          <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Property</label>
          <select id="proj-property"
            class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none">
            <option value="">Unassigned</option>
            ${props.map(p => `<option value="${escapeHtml(p?.name)}">${escapeHtml(p?.name || 'Unnamed Property')}</option>`).join('')}
          </select>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Budget</label>
            <input type="number" id="proj-budget"
              class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
              value="0" min="0" step="1000">
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Spent</label>
            <input type="number" id="proj-spent"
              class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
              value="0" min="0" step="1000">
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Lead</label>
            <input type="text" id="proj-lead"
              class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
              placeholder="e.g. PM / GC / Owner">
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Status</label>
            <select id="proj-status"
              class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none">
              ${['Active', 'Paused', 'Completed', 'Cancelled'].map(s => `<option>${escapeHtml(s)}</option>`).join('')}
            </select>
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Percent Complete</label>
          <input type="number" id="proj-percent"
            class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
            value="0" min="0" max="100" step="1">
        </div>
      </div>
    `;

    modalManager.show(
      'Add Project',
      formHtml,
      () => {
        const data = this.readProjectFormData();

        if (!data.name) throw new Error('Project name is required.');

        const now = new Date().toISOString();
        data.created_at = now;
        data.createdAt = now;

        stateManager.add('projects', data);
        return true;
      },
      { submitLabel: 'Add', cancelLabel: 'Cancel' }
    );
  },

  showEditProjectModal(proj) {
    const props = getProperties(this._lastState);

    const name = escapeHtml(proj?.name || '');
    const property = escapeHtml(proj?.property || '');
    const budget = toNumber(proj?.budget, 0);
    const spent = toNumber(proj?.spent, 0);
    const lead = escapeHtml(proj?.lead || '');
    const status = escapeHtml(proj?.status || 'Active');
    const percent = clamp(
      normalizeKey(proj?.status) === 'completed' ? 100 : toNumber(proj?.percent_complete, 0),
      0,
      100
    );

    const formHtml = `
      <div class="space-y-5">
        <div>
          <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Project Name</label>
          <input type="text" id="proj-name"
            class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
            value="${name}">
        </div>

        <div>
          <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Property</label>
          <select id="proj-property"
            class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none">
            <option value="">Unassigned</option>
            ${props.map(p => {
              const val = String(p?.name || '');
              const selected = val === property ? 'selected' : '';
              return `<option value="${escapeHtml(val)}" ${selected}>${escapeHtml(val || 'Unnamed Property')}</option>`;
            }).join('')}
          </select>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Budget</label>
            <input type="number" id="proj-budget"
              class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
              value="${budget}" min="0" step="1000">
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Spent</label>
            <input type="number" id="proj-spent"
              class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
              value="${spent}" min="0" step="1000">
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Lead</label>
            <input type="text" id="proj-lead"
              class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
              value="${lead}" placeholder="e.g. PM / GC / Owner">
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Status</label>
            <select id="proj-status"
              class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none">
              ${['Active', 'Paused', 'Completed', 'Cancelled'].map(s => {
                const sel = s === status ? 'selected' : '';
                return `<option ${sel}>${escapeHtml(s)}</option>`;
              }).join('')}
            </select>
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Percent Complete</label>
          <input type="number" id="proj-percent"
            class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
            value="${percent}" min="0" max="100" step="1">
        </div>

        <div class="p-4 bg-slate-50 rounded-xl border border-slate-200">
          <div class="flex items-center justify-between text-sm font-bold text-slate-700">
            <span>Variance</span>
            <span id="proj-variance-live">${formatters.dollars(budget - spent)}</span>
          </div>
          <p class="text-[11px] font-semibold text-slate-400 mt-1">
            Tip: Update budget/spend and your cards + portfolio bar will reflect immediately after saving.
          </p>
        </div>
      </div>
    `;

    modalManager.show(
      'Manage Spend',
      formHtml,
      () => {
        const patch = this.readProjectFormData();

        if (!patch.name) throw new Error('Project name is required.');

        // If status is completed, force percent to 100
        if (normalizeKey(patch.status) === 'completed') {
          patch.percent_complete = 100;
        } else {
          patch.percent_complete = clamp(patch.percent_complete, 0, 100);
        }

        const now = new Date().toISOString();
        patch.updated_at = now;
        patch.updatedAt = now;

        stateManager.update('projects', proj.id, patch);
        return true;
      },
      { submitLabel: 'Save', cancelLabel: 'Cancel' }
    );

    // Optional: live variance update while modal open (safe guards)
    setTimeout(() => {
      const b = document.getElementById('proj-budget');
      const s = document.getElementById('proj-spent');
      const out = document.getElementById('proj-variance-live');
      if (!b || !s || !out) return;

      const update = () => {
        const budgetNow = toNumber(b.value, 0);
        const spentNow = toNumber(s.value, 0);
        out.textContent = formatters.dollars(budgetNow - spentNow);
      };

      b.addEventListener('input', update);
      s.addEventListener('input', update);
    }, 0);
  },

  readProjectFormData() {
    return {
      name: String(document.getElementById('proj-name')?.value ?? '').trim(),
      property: String(document.getElementById('proj-property')?.value ?? '').trim(),
      budget: toNumber(document.getElementById('proj-budget')?.value, 0),
      spent: toNumber(document.getElementById('proj-spent')?.value, 0),
      lead: String(document.getElementById('proj-lead')?.value ?? '').trim(),
      status: String(document.getElementById('proj-status')?.value ?? 'Active').trim(),
      percent_complete: clamp(toNumber(document.getElementById('proj-percent')?.value, 0), 0, 100)
    };
  },

  getStatusClass(status) {
    const s = normalizeKey(status);
    if (s === 'completed') return 'bg-emerald-100 text-emerald-700';
    if (s === 'paused') return 'bg-amber-100 text-amber-700';
    if (s === 'cancelled') return 'bg-red-100 text-red-700';
    return 'bg-slate-100 text-slate-600';
  }
};

function normalizeKey(v) {
  return String(v ?? '').trim().toLowerCase();
}

// Compatibility exports
export const renderProjects = (state) => projects.render(state);
export const showAddProjectModal = () => projects.showAddProjectModal();
