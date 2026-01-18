/**
 * src/modules/tasks.js
 * Handles task tracking, priority management, and relational linking.
 */

import { stateManager } from '../state.js';
import { formatters } from '../utils/formatters.js';
import { modalManager } from '../utils/modals.js';

export const tasks = {
    /**
     * Main render function
     */
    render(state) {
        const container = document.getElementById('view-tasks');
        if (!container) return;

        const taskList = state.tasks || [];
        
        // Stats Summary
        const pendingCount = taskList.filter(t => !t.completed).length;
        const overdueCount = taskList.filter(t => !t.completed && new Date(t.due_date) < new Date().setHours(0,0,0,0)).length;

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
        if (taskList.length === 0) {
            return `
                <div class="py-24 text-center border-2 border-dashed border-slate-200 rounded-[2rem] bg-white">
                    <div class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <i class="fa fa-check-double text-slate-200 text-2xl"></i>
                    </div>
                    <p class="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Clear skies. No pending tasks.</p>
                </div>`;
        }

        const sortedTasks = [...taskList].sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            return new Date(a.due_date) - new Date(b.due_date);
        });

        return sortedTasks.map(task => {
            const isOverdue = !task.completed && new Date(task.due_date) < new Date().setHours(0,0,0,0);
            
            return `
                <div class="group bg-white p-5 rounded-2xl border ${task.completed ? 'border-slate-100 opacity-60' : 'border-slate-200 shadow-sm'} flex items-center gap-5 transition-all hover:border-slate-400">
                    <button data-action="task-toggle" data-id="${task.id}" 
                        class="flex-shrink-0 w-8 h-8 rounded-xl border-2 flex items-center justify-center transition-all ${task.completed ? 'bg-emerald-500 border-emerald-500 text-white rotate-[360deg]' : 'border-slate-200 hover:border-slate-900 text-transparent'}">
                        <i class="fa fa-check text-xs"></i>
                    </button>

                    <div class="flex-grow min-w-0">
                        <div class="flex items-center gap-3 mb-1">
                            <h4 class="font-black text-sm ${task.completed ? 'text-slate-400 line-through' : 'text-slate-900'} truncate tracking-tight">
                                ${task.title}
                            </h4>
                            <span class="px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-widest ${this.getPriorityClass(task.priority)}">
                                ${task.priority || 'Normal'}
                            </span>
                        </div>
                        <div class="flex items-center gap-4 text-[10px] font-bold uppercase tracking-tighter">
                            <span class="${isOverdue ? 'text-red-500' : 'text-slate-400'}">
                                <i class="fa fa-clock mr-1 opacity-50"></i>${formatters.relativeDays(task.due_date)}
                            </span>
                            ${task.linked_deal ? `
                                <span class="text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                                    <i class="fa fa-briefcase mr-1 opacity-50"></i>${task.linked_deal}
                                </span>
                            ` : ''}
                        </div>
                    </div>

                    <button data-action="task-delete" data-id="${task.id}" class="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500 transition-all">
                        <i class="fa fa-trash-alt text-xs"></i>
                    </button>
                </div>
            `;
        }).join('');
    },

    bindEvents() {
        const addBtn = document.getElementById('add-task-btn');
        if (addBtn) addBtn.onclick = () => this.showAddTaskModal();

        document.querySelectorAll('[data-action="task-toggle"]').forEach(btn => {
            btn.onclick = (e) => {
                const id = e.currentTarget.dataset.id;
                const task = stateManager.get().tasks.find(t => t.id === id);
                if (task) {
                    stateManager.update('tasks', id, { completed: !task.completed });
                }
            };
        });

        document.querySelectorAll('[data-action="task-delete"]').forEach(btn => {
            btn.onclick = (e) => {
                const id = e.currentTarget.dataset.id;
                if (confirm("Permanently delete this task?")) {
                    stateManager.delete('tasks', id);
                }
            };
        });
    },

    showAddTaskModal() {
        const state = stateManager.get();
        const dealOptions = (state.deals || []).map(d => `<option value="${d.name}">${d.name}</option>`).join('');

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

        modalManager.show("Add Task Milestone", formHtml, () => {
            const data = {
                title: document.getElementById('task-title').value,
                due_date: document.getElementById('task-date').value,
                priority: document.getElementById('task-priority').value,
                linked_deal: document.getElementById('task-link').value,
                completed: false,
                id: Date.now().toString()
            };

            if (data.title && data.due_date) {
                stateManager.add('tasks', data);
            }
        });
    },

    getPriorityClass(priority) {
        const p = (priority || '').toLowerCase();
        if (p === 'high') return 'bg-red-950 text-red-400';
        if (p === 'medium') return 'bg-orange-100 text-orange-700';
        return 'bg-slate-100 text-slate-500';
    }
};