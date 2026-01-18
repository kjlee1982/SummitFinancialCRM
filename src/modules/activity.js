/**
 * src/modules/activity.js
 * Handles the rendering and filtering of the CRM Audit Trail.
 */

import { formatters } from '../utils/formatters.js';

/**
 * Maps activity text or types to FontAwesome icons
 */
function getActivityIcon(text) {
  const t = text.toLowerCase();
  if (t.includes('contact')) return 'fa-user-plus text-blue-500';
  if (t.includes('deal')) return 'fa-handshake text-green-500';
  if (t.includes('task')) return 'fa-check-circle text-purple-500';
  if (t.includes('investor')) return 'fa-piggy-bank text-amber-500';
  if (t.includes('delete')) return 'fa-trash text-red-500';
  return 'fa-info-circle text-gray-400';
}

export function renderActivity(activities) {
  const container = document.getElementById('activity-feed-container');
  if (!container) return;

  if (!activities || activities.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center text-gray-500">
        <i class="fa fa-history mb-2 text-2xl opacity-20"></i>
        <p>No recent activity found.</p>
      </div>
    `;
    return;
  }

  // Generate HTML for the timeline
  const html = activities.map((act, index) => {
    const isLast = index === activities.length - 1;
    const iconClass = getActivityIcon(act.text);
    
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
              <span class="font-medium text-gray-900">${act.text}</span>
            </div>
            <div class="text-xs text-gray-400 mt-0.5">
              ${formatters.date(act.at)} at ${new Date(act.at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = `<div class="flow-root p-4">${html}</div>`;
}

/**
 * Helper to log an activity through the state manager
 */
export function createActivityEntry(text, type = 'general') {
  return {
    text,
    type,
    at: new Date().toISOString()
  };
} // This closing bracket was missing or misplaced

// Export the object that main.js is looking for
export const activity = {
  createActivityEntry,
  renderActivity
};