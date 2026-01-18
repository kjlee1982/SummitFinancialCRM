/**
 * src/modules/calendar.js
 * Handles the logic and rendering for the CRM Calendar view.
 */

import { formatters } from '../utils/formatters.js';

let viewDate = new Date(); // The month the user is currently looking at

export const calendar = {
  
  /**
   * Main render function called by the router
   */
  render(state) {
    const container = document.getElementById('view-calendar');
    if (!container) return;

    container.innerHTML = `
      <div class="p-6">
        <div class="flex items-center justify-between mb-6">
          <h2 class="text-2xl font-bold text-gray-800">${this.getMonthName(viewDate)} ${viewDate.getFullYear()}</h2>
          <div class="flex gap-2">
            <button data-action="cal-prev" class="p-2 hover:bg-gray-200 rounded-lg border border-gray-300">
              <i class="fa fa-chevron-left"></i>
            </button>
            <button data-action="cal-today" class="px-4 py-2 hover:bg-gray-200 rounded-lg border border-gray-300 text-sm font-medium">
              Today
            </button>
            <button data-action="cal-next" class="p-2 hover:bg-gray-200 rounded-lg border border-gray-300">
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
    
    const firstDay = new Date(year, month, 1).getDay();
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

    // Actual days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = new Date(year, month, d).toDateString();
      const isToday = dateStr === today;
      
      // Filter events for this day
      const dayEvents = state.appointments.filter(appt => 
        new Date(appt.start_at).toDateString() === dateStr
      );

      html += `
        <div class="h-32 border-b border-r border-gray-100 p-2 hover:bg-gray-50 transition-colors">
          <div class="flex justify-between items-start">
            <span class="text-sm font-medium ${isToday ? 'bg-blue-600 text-white w-6 h-6 flex items-center justify-center rounded-full' : 'text-gray-700'}">
              ${d}
            </span>
          </div>
          <div class="mt-2 space-y-1 overflow-y-auto max-h-20">
            ${dayEvents.map(e => `
              <div class="px-2 py-0.5 text-[10px] bg-blue-100 text-blue-700 rounded truncate border border-blue-200" title="${e.title}">
                ${new Date(e.start_at).toLocaleTimeString([], {hour: 'numeric', minute:'2-digit'})} ${e.title}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    html += `</div>`;
    return html;
  },

  getMonthName(date) {
    return date.toLocaleString('default', { month: 'long' });
  },

  bindEvents() {
    // These listeners are captured by the main.js delegation, 
    // but you can add local logic here if needed.
  },

  changeMonth(delta) {
    viewDate.setMonth(viewDate.getMonth() + delta);
  },

  goToday() {
    viewDate = new Date();
  }
};