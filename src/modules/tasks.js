/**
 * src/modules/tasks.js
 * Handles task tracking, priority management, and relational linking.
 *
 * Overwrite updates included:
 * - Array guards (state.tasks/state.deals)
 * - Fixed overdue logic (date-to-date compare, not Date vs number)
 * - Bind-once delegated events on #view-tasks
 * - Delete uses modalManager (danger) instead of confirm()
 * - Escapes rendered fields (title + linked_deal)
 * - Modal saves return true (close reliably)
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

function getTasks(state) {
  return Array.isArray(state?.tasks) ? state.tasks : [];
}

function getDeals(state) {
  return Array.isArray(state?.deals) ? state.deals : [];
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseDueDate(dueStr) {
  // dueStr is expected as "YYYY-MM-DD" from <input type="date">
  // new Date("YYYY-MM-DD") parses as UTC in some browsers; to avoid TZ drift, parse manually.
  const s = String(dueStr ?? '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10) - 1;
  const da = parseInt(m[3], 10);
  const d = new Date(y, mo, da);
  d.setHours(0, 0, 0, 0);
  return d;
}

export const tasks = {
  _bound: false,

  /**
   * Main render function
   */
  render(state) {
    const container = document.getElementById('view-tasks');
    if (!container) return;

    const taskList = getTasks(state);

    const today0 = startOfToday();

    // Stats Summary
    const pendingCount = taskList.filter(t => !t?.completed).length;
    const overdueCount = taskList.filter(t => {
      if (t?.completed) return false;
      const due = parseDueDate(t?.due_date);
      return !!due && due < today0;
    }).length;

    container.innerHTML = `
      <div class="p-6 max-w-5xl mx-auto">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h2 class="text-2xl font-black text-slate-900 tracking-tight italic">Operations & Milestones</h2>
            <div class="flex gap-4 mt-1">
              <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Active: <span class="text-slate-900">${pendingCount}</span>
              </span>
              ${overdueCount > 0 ? `
                <span class="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center">
                  <span class="w-1.5 h-1.5 bg-red-500 rounded-full mr-1.5 animate-pulse"></span>
                  Overdue: ${overdueCount}
                </span>
              ` : ''}
            </div>
          </div>
          <button id="add-task-btn" class="bg-slate-900 text-white px-5 py-2.5 rounded-xl hover:bg-slate-800 font-bold shadow-sm transition-all flex items-center text-xs uppercase tracking-widest">
            <i class="fa fa-plus-circle mr-2 text-[10px]"></i>New Milestone
          </button>
        </div>

        <div class="space-y-3" id="tasks-container">
          ${this.renderTaskItems(taskList)}
        </div>
      </div>
    `;

    this.bindEvents();
  },

  /**
   * Renders individual task rows
   */
  renderTaskItems(taskList) {
    const list = Array.isArray(taskList) ? taskList : [];
    if (list.length === 0) {
      return `
        <div class="py-24 text-center border-2 border-dashed border-slate-200 rounded-[2rem] bg-white">
          <div class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <i class="fa fa-check-double text-slate-200 text-2xl"></i>
          </div>
          <p class="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Clear skies. No pending tasks.</p>
        </div>`;
    }

    const today0 = startOfToday();

    const sortedTasks = [...list].sort((a, b) => {
      // incomplete first, then earliest due date
      const ac = !!a?.completed;
      const bc = !!b?.completed;
      if (ac !== bc) return ac ? 1 : -1;

      const ad = parseDueDate(a?.due_date) || new Date(9999, 0, 1);
      const bd = parseDueDate(b?.due_date) || new Date(9999, 0, 1);
      return ad - bd;
    });

    return sortedTasks.map(task => {
      const due = parseDueDate(task?.due_date);
      const isOverdue = !task?.completed && !!due && due < today0;

      const title = escapeHtml(task?.title || '');
      const priority = escapeHtml(task?.priority || 'Normal');
      const linkedDeal = escapeHtml(task?.linked_deal || '');

      return `
        <div class="group bg-white p-5 rounded-2xl border ${task?.completed ? 'border-slate-100 opacity-60' : 'border-slate-200 shadow-sm'} flex items-center gap-5 transition-all hover:border-slate-400">
          <button data-action="task-toggle" data-id="${escapeHtml(task?.id)}"
            class="flex-shrink-0 w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all ${task?.completed ? 'bg-emerald-500 border-emerald-500 text-white rotate-[360deg]' : 'border-slate-200 hover:border-slate-900 text-transparent'}">
            <i class="fa fa-check text-xs"></i>
          </button>

          <div class="flex-grow min-w-0">
            <div class="flex items-center gap-3 mb-1">
              <h4 class="font-black text-sm ${task?.completed ? 'text-slate-400 line-through' : 'text-slate-900'} truncate tracking-tight">
                ${title}
              </h4>
              <span class="px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest ${this.getPriorityClass(task?.priority)}">
                ${priority}
              </span>
            </div>

            <div class="flex items-center gap-4 text-[10px] font-bold uppercase tracking-tighter">
              <span class="${isOverdue ? 'text-red-500' : 'text-slate-400'}">
                <i class="fa fa-clock mr-1 opacity-50"></i>${formatters.relativeDays(task?.due_date)}
              </span>

              ${linkedDeal ? `
                <span class="text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                  <i class="fa fa-briefcase mr-1 opacity-50"></i>${linkedDeal}
                </span>
              ` : ''}
            </div>
          </div>

          <button data-action="task-delete" data-id="${escapeHtml(task?.id)}"
            class="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500 transition-all">
            <i class="fa fa-trash-alt text-xs"></i>
          </button>
        </div>
      `;
    }).join('');
  },

  bindEvents() {
    const container = document.getElementById('view-tasks');
    if (!container) return;

    const addBtn = document.getElementById('add-task-btn');
    if (addBtn) addBtn.onclick = () => this.showAddTaskModal();

    if (this._bound) return;
    this._bound = true;

    // Delegated actions
    container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const id = btn.dataset.id;

      if (action === 'task-toggle') {
        const state = stateManager.get();
        const taskList = getTasks(state);
        const t = taskList.find(x => String(x?.id) === String(id));
        if (t) stateManager.update('tasks', id, { completed: !t.completed });
        return;
      }

      if (action === 'task-delete') {
        this.confirmDelete(id);
      }
    });
  },

  confirmDelete(id) {
    modalManager.show(
      'Delete task',
      `<p class="text-sm font-semibold text-slate-700">Permanently delete this task? This cannot be undone.</p>`,
      () => {
        stateManager.delete('tasks', id);
        return true;
      },
      { submitLabel: 'Delete', cancelLabel: 'Cancel', danger: true }
    );
  },

  showAddTaskModal() {
    const state = stateManager.get();
    const deals = getDeals(state);

    const dealOptions = deals
      .map(d => {
        const name = String(d?.name ?? '').trim();
        if (!name) return '';
        return `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`;
      })
      .filter(Boolean)
      .join('');

    const formHtml = `
      <div class="space-y-5">
        <div>
          <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Action Item</label>
          <input type="text" id="task-title" class="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-slate-900 transition-all font-bold" placeholder="e.g. Confirm Deposit">
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Deadline</label>
            <input type="date" id="task-date" class="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold">
          </div>
          <div>
            <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Priority</label>
            <select id="task-priority" class="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold">
              <option value="Low">Low</option>
              <option value="Medium" selected>Medium</option>
              <option value="High">High</option>
            </select>
          </div>
        </div>

        <div>
          <label class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Project/Deal Association</label>
          <select id="task-link" class="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold">
            <option value="">General Overhead (No Link)</option>
            ${dealOptions}
          </select>
        </div>
      </div>
    `;

    modalManager.show('Add Task Milestone', formHtml, () => {
      const title = String(document.getElementById('task-title')?.value ?? '').trim();
      const due_date = String(document.getElementById('task-date')?.value ?? '').trim();
      const priority = String(document.getElementById('task-priority')?.value ?? 'Medium').trim();
      const linked_deal = String(document.getElementById('task-link')?.value ?? '').trim();

      if (!title) throw new Error('Task title is required.');
      if (!due_date || !parseDueDate(due_date)) throw new Error('A valid deadline is required.');

      const id = (globalThis.crypto?.randomUUID?.() || Date.now().toString());

      const data = {
        id,
        title,
        due_date,
        priority,
        linked_deal,
        completed: false
      };

      stateManager.add('tasks', data);
      return true;
    });
  },

  getPriorityClass(priority) {
    const p = (priority || '').toLowerCase();
    if (p === 'high') return 'bg-red-950 text-red-400';
    if (p === 'medium') return 'bg-orange-100 text-orange-700';
    return 'bg-slate-100 text-slate-500';
  }
};

export const renderTasks = (state) => tasks.render(state);
export const showAddTaskModal = () => tasks.showAddTaskModal();
