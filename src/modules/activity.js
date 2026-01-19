/**
 * src/modules/activity.js
 * Handles the rendering and filtering of the CRM Audit Trail.
 */

import { formatters } from '../utils/formatters.js';

/**
 * Maps activity text to FontAwesome icons
 */
function getActivityIcon(text = '') {
  const t = String(text).toLowerCase();
  if (t.includes('contact')) return 'fa-user-plus text-blue-500';
  if (t.includes('deal')) return 'fa-handshake text-green-500';
  if (t.includes('task')) return 'fa-check-circle text-purple-500';
  if (t.includes('investor')) return 'fa-piggy-bank text-amber-500';
  if (t.includes('delete')) return 'fa-trash text-red-500';
  return 'fa-info-circle text-gray-400';
}

/**
 * Internal renderer for the activity timeline
 */
function renderTimeline(activities) {
  if (!activities || activities.length === 0) {
    return `
      <div class="p-8 text-center text-gray-500">
        <i class="fa fa-history mb-2 text-2xl opacity-20"></i>
        <p>No recent activity found.</p>
      </div>
    `;
  }

  const html = activities.map((act, index) => {
    const isLast = index === activities.length - 1;
    const iconClass = getActivityIcon(act?.text);

    const at = act?.at ? new Date(act.at) : null;
    const timeStr =
      at && !Number.isNaN(at.getTime())
        ? at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';

    return `
      <div class="relative pb-8">
        ${!isLast ? '<span class="absolute top-5 left-5 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true"></span>' : ''}
        <div class="relative flex items-start space-x-3">
          <div class="relative">
            <div class="h-10 w-10 rounded-full bg-gray-50 flex items-center justify-center ring-8 ring-white">
              <i class="fa ${iconClass}"></i>
            </div>
          </div>
          <div class="min-w-0 flex-1 py-1.5">
            <div class="text-sm text-gray-500">
              <span class="font-medium text-gray-900">${act?.text ?? ''}</span>
            </div>
            <div class="text-xs text-gray-400 mt-0.5">
              ${act?.at ? `${formatters.date(act.at)}${timeStr ? ` at ${timeStr}` : ''}` : '—'}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  return `<div class="flow-root p-4">${html}</div>`;
}

/**
 * Helper to create an activity entry object (if a module wants to build one)
 */
export function createActivityEntry(text, type = 'general') {
  return {
    text,
    type,
    at: new Date().toISOString()
  };
}

/**
 * Export the object main.js expects: activity.render(state)
 */
export const activity = {
  createActivityEntry,

  /**
   * Renders the Activity view into #view-activity (matches index.html)
   */
  render(state) {
    const host = document.getElementById('view-activity');
    if (!host) return;

    const activities = Array.isArray(state?.activities) ? state.activities : [];

    host.innerHTML = `
      <div class="p-6 md:p-8">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-2xl font-black tracking-tight text-slate-900">Activity</h2>
          <span class="text-xs font-bold text-slate-500 uppercase tracking-widest">
            Audit Trail
          </span>
        </div>

        <div class="bg-white rounded-2xl shadow-sm border border-slate-200">
          ${renderTimeline(activities)}
        </div>
      </div>
    `;
  }
};
