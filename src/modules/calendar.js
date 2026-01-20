/**
 * src/modules/calendar.js
 * Handles the logic and rendering for the CRM Calendar view.
 */

import { modalManager } from '../utils/modals.js';

let viewDate = new Date(); // The month the user is currently looking at
let currentState = null;   // Local reference to state for re-rendering

function escapeHtml(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function safeDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatTime(d) {
  if (!d) return '';
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export const calendar = {
  /**
   * Main render function called by the router
   */
  render(state) {
    const container = document.getElementById('view-calendar');
    if (!container) return;

    // Save state reference so we can re-render when the month changes
    currentState = state;

    container.innerHTML = `
      <div class="p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-2xl font-bold text-gray-800">${this.getMonthName(viewDate)} ${viewDate.getFullYear()}</h2>
          <div class="flex gap-2">
            <button id="cal-prev" class="p-2 hover:bg-gray-200 rounded-lg border border-gray-300 transition-colors">
              <i class="fa fa-chevron-left"></i>
            </button>
            <button id="cal-today" class="px-4 py-2 hover:bg-gray-200 rounded-lg border border-gray-300 text-sm font-medium transition-colors">
              Today
            </button>
            <button id="cal-next" class="p-2 hover:bg-gray-200 rounded-lg border border-gray-300 transition-colors">
              <i class="fa fa-chevron-right"></i>
            </button>
          </div>
        </div>

        <div class="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          ${this.generateGridHTML(state)}
        </div>
      </div>
    `;

    this.bindEvents();
  },

  generateGridHTML(state) {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const firstDay = new Date(year, month, 1).getDay(); // 0..6
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date().toDateString();

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    let html = `<div class="grid grid-cols-7 border-b border-gray-200 bg-gray-50">`;

    // Day headers
    days.forEach(d => {
      html += `<div class="py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">${d}</div>`;
    });
    html += `</div><div class="grid grid-cols-7">`;

    // Padding for first week
    for (let i = 0; i < firstDay; i++) {
      html += `<div class="h-32 border-b border-r border-gray-100 bg-gray-50/50"></div>`;
    }

    const appointments = Array.isArray(state?.appointments) ? state.appointments : [];

    // Actual days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateInstance = new Date(year, month, d);
      const dateStr = dateInstance.toDateString();
      const isToday = dateStr === today;

      // Filter + guard invalid dates + sort by time
      const dayEvents = appointments
        .filter(appt => {
          const dt = safeDate(appt?.start_at);
          if (!dt) return false;
          return dt.toDateString() === dateStr;
        })
        .sort((a, b) => {
          const da = safeDate(a?.start_at);
          const db = safeDate(b?.start_at);
          return (da?.getTime() || 0) - (db?.getTime() || 0);
        });

      html += `
        <div class="h-32 border-b border-r border-gray-100 p-2 hover:bg-gray-50 transition-colors group">
          <div class="flex justify-between items-start">
            <span class="text-sm font-medium ${isToday ? 'bg-blue-600 text-white w-7 h-7 flex items-center justify-center rounded-full' : 'text-gray-700'}">
              ${d}
            </span>
          </div>

          <div class="mt-2 space-y-1 overflow-y-auto max-h-20 custom-scrollbar">
            ${dayEvents.map(e => {
              const start = safeDate(e?.start_at);
              const title = escapeHtml(e?.title || '(Untitled)');
              const id = escapeHtml(e?.id || '');
              return `
                <div
                  class="px-2 py-1 text-[10px] bg-blue-50 text-blue-700 rounded truncate border border-blue-100 cursor-pointer hover:bg-blue-100 transition-colors"
                  title="${title}"
                  data-action="appointment-open"
                  data-id="${id}"
                >
                  <span class="font-bold">${formatTime(start)}</span> ${title}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    }

    // Trailing padding so the last week row is complete
    const totalCells = firstDay + daysInMonth;
    const trailing = (7 - (totalCells % 7)) % 7;
    for (let i = 0; i < trailing; i++) {
      html += `<div class="h-32 border-b border-r border-gray-100 bg-gray-50/50"></div>`;
    }

    html += `</div>`;
    return html;
  },

  getMonthName(date) {
    return date.toLocaleString('default', { month: 'long' });
  },

  bindEvents() {
    // Month navigation
    const prevBtn = document.getElementById('cal-prev');
    const nextBtn = document.getElementById('cal-next');
    const todayBtn = document.getElementById('cal-today');

    if (prevBtn) prevBtn.onclick = () => { this.changeMonth(-1); };
    if (nextBtn) nextBtn.onclick = () => { this.changeMonth(1); };
    if (todayBtn) todayBtn.onclick = () => { this.goToday(); };

    // Delegated event click (bind once)
    const container = document.getElementById('view-calendar');
    if (!container) return;
    if (container.dataset.calBound === '1') return;
    container.dataset.calBound = '1';

    container.addEventListener('click', (e) => {
      const chip = e.target.closest('[data-action="appointment-open"]');
      if (!chip) return;

      const id = chip.dataset.id;
      const appointments = Array.isArray(currentState?.appointments) ? currentState.appointments : [];
      const appt = appointments.find(a => String(a?.id) === String(id));

      if (!appt) {
        modalManager.show(
          'Event not found',
          `<p class="text-sm font-semibold text-slate-700">That event could not be found. It may have been deleted or not synced yet.</p>`,
          () => true,
          { submitLabel: 'Close', hideCancel: true }
        );
        return;
      }

      const start = safeDate(appt.start_at);
      const end = safeDate(appt.end_at);
      const when = start
        ? `${start.toLocaleDateString()} • ${formatTime(start)}${end ? `–${formatTime(end)}` : ''}`
        : '—';

      modalManager.show(
        escapeHtml(appt.title || 'Appointment'),
        `
          <div class="space-y-3">
            <div class="text-sm font-semibold text-slate-700">
              <div class="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">When</div>
              <div>${escapeHtml(when)}</div>
            </div>

            ${appt.location ? `
              <div class="text-sm font-semibold text-slate-700">
                <div class="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Location</div>
                <div>${escapeHtml(appt.location)}</div>
              </div>
            ` : ''}

            ${appt.notes ? `
              <div class="text-sm font-semibold text-slate-700">
                <div class="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">Notes</div>
                <div class="whitespace-pre-wrap">${escapeHtml(appt.notes)}</div>
              </div>
            ` : ''}
          </div>
        `,
        () => true,
        { submitLabel: 'Close', hideCancel: true }
      );
    });
  },

  changeMonth(delta) {
    viewDate.setMonth(viewDate.getMonth() + delta);
    this.render(currentState); // Trigger UI update
  },

  goToday() {
    viewDate = new Date();
    this.render(currentState); // Trigger UI update
  }
};
