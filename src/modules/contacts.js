/**
 * src/modules/contacts.js
 * Manages general business relationships (Brokers, Lenders, Vendors).
 *
 * Updates included:
 * - Notes field (stored as contact.notes)
 * - Click email/phone line to copy-to-clipboard
 * - Delegated events (no rebinding on re-render)
 * - Edit + Delete via modalManager (danger delete)
 * - Filter row with debounced search only
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

function debounce(fn, wait = 250) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

function normalizeEmail(email) {
  const e = String(email ?? '').trim();
  return e || '';
}

function normalizePhone(phone) {
  const p = String(phone ?? '').trim();
  return p || '';
}

function getInitials(name) {
  const n = String(name ?? '').trim();
  if (!n) return '?';
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0].slice(0, 1) + parts[parts.length - 1].slice(0, 1)).toUpperCase();
}

function buildContactFormHtml(contact = null) {
  const isEdit = !!contact;
  const name = contact?.name ?? '';
  const company = contact?.company ?? '';
  const category = contact?.category ?? 'General';
  const phone = contact?.phone ?? '';
  const email = contact?.email ?? '';
  const notes = contact?.notes ?? '';

  // Expanded categories to support personal + informal relationship tracking
  // (Friend/Family/Acquaintance) in addition to professional roles.
  const categories = [
    'Broker',
    'Lender',
    'Attorney',
    'Property Manager',
    'Contractor',
    'Insurance',
    'Investor',
    'Partner',
    'Vendor',
    'Friend',
    'Family',
    'Acquaintance',
    'General'
  ];

  return `
    <div class="grid grid-cols-2 gap-4">
      <div class="col-span-2">
        <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Full Name</label>
        <input type="text" id="contact-name" class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
          placeholder="e.g. Sarah Jenkins" value="${escapeHtml(name)}">
      </div>

      <div class="col-span-2">
        <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Company / Firm</label>
        <input type="text" id="contact-company" class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
          placeholder="e.g. CBRE or Chase Bank" value="${escapeHtml(company)}">
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Category</label>
        <select id="contact-category" class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none">
          ${categories
            .map((c) => `<option ${String(category) === c ? 'selected' : ''}>${escapeHtml(c)}</option>`)
            .join('')}
        </select>
      </div>

      <div>
        <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Phone Number</label>
        <input type="tel" id="contact-phone" class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
          placeholder="555-0123" value="${escapeHtml(phone)}">
      </div>

      <div class="col-span-2">
        <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Email Address</label>
        <input type="email" id="contact-email" class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
          value="${escapeHtml(email)}">
      </div>

      <div class="col-span-2">
        <label class="block text-xs font-bold text-gray-400 uppercase mb-1">Notes</label>
        <textarea id="contact-notes" rows="4"
          class="w-full p-3 border rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
          placeholder="Anything important: last convo, preferences, next follow-up...">${escapeHtml(notes)}</textarea>
      </div>

      ${
        isEdit
          ? `<p class="col-span-2 text-[11px] font-semibold text-slate-400 mt-1">Editing updates are saved to cloud automatically.</p>`
          : ''
      }
    </div>
  `;
}

async function copyToClipboard(text) {
  const t = String(text ?? '').trim();
  if (!t) return false;

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(t);
      return true;
    }
  } catch (e) {
    // fall through to execCommand fallback
  }

  // Fallback
  try {
    const ta = document.createElement('textarea');
    ta.value = t;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return !!ok;
  } catch (e) {
    return false;
  }
}

function showToast(message, tone = 'success') {
  const icon =
    tone === 'error'
      ? `<i class="fa fa-triangle-exclamation text-red-600 text-2xl"></i>`
      : `<i class="fa fa-circle-check text-emerald-600 text-2xl"></i>`;

  modalManager.show(
    'Copied',
    `
      <div class="flex items-start gap-3">
        <div class="mt-0.5">${icon}</div>
        <div class="text-sm font-semibold text-slate-700 leading-relaxed">${escapeHtml(message)}</div>
      </div>
    `,
    () => true,
    { submitLabel: 'OK', hideCancel: true }
  );
}

export const contacts = {
  _lastState: null,

  _filters: {
    q: '',
    category: 'all'
  },

  _bound: false,
  _debouncedSearch: null,

  render(state) {
    const container = document.getElementById('view-contacts');
    if (!container) return;

    this._lastState = state;

    const allContacts = Array.isArray(state?.contacts) ? state.contacts : [];
    const filtered = this.applyFilters(allContacts, this._filters);

    const categories = Array.from(
      new Set(allContacts.map((c) => String(c?.category || 'General').trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));

    container.innerHTML = `
      <div class="p-6">
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h2 class="text-2xl font-bold text-gray-900">Contact Directory</h2>
            <p class="text-sm text-gray-500 font-medium">
              Showing <span class="font-black text-gray-900">${filtered.length}</span> of <span class="font-black text-gray-900">${allContacts.length}</span> contacts.
            </p>
          </div>

          <button id="add-contact-btn"
            class="bg-slate-900 text-white px-5 py-2.5 rounded-lg hover:bg-slate-800 font-bold shadow-sm transition-all flex items-center text-sm">
            <i class="fa fa-plus mr-2"></i>Add Contact
          </button>
        </div>

        <!-- Filter Row -->
        <div class="bg-white border border-gray-200 rounded-xl shadow-sm p-4 mb-8">
          <div class="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div class="md:col-span-7">
              <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Search</label>
              <input id="contacts-q" type="text"
                value="${escapeHtml(this._filters.q)}"
                placeholder="Search by name, company, email, phone, notes..."
                class="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10" />
              <p class="mt-1 text-[10px] text-slate-400 font-bold">Debounced</p>
            </div>

            <div class="md:col-span-4">
              <label class="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Category</label>
              <select id="contacts-category"
                class="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-slate-900/10">
                <option value="all" ${this._filters.category === 'all' ? 'selected' : ''}>All</option>
                ${categories
                  .map(
                    (c) =>
                      `<option value="${escapeHtml(c)}" ${
                        this._filters.category === c ? 'selected' : ''
                      }>${escapeHtml(c)}</option>`
                  )
                  .join('')}
              </select>
            </div>

            <div class="md:col-span-1 flex md:justify-end">
              <button id="contacts-reset"
                class="w-full md:w-auto px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-black hover:bg-slate-800 transition-all"
                title="Reset filters">
                Reset
              </button>
            </div>

            <div class="md:col-span-12 mt-1">
              <p class="text-[11px] font-semibold text-slate-500">
                Tip: click email/phone line to copy
              </p>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
          ${this.renderContactCards(filtered)}
        </div>
      </div>
    `;

    this.bindEvents();
  },

  applyFilters(list, filters) {
    const q = String(filters?.q ?? '').trim().toLowerCase();
    const cat = String(filters?.category ?? 'all');

    return (Array.isArray(list) ? list : []).filter((c) => {
      const category = String(c?.category || 'General').trim();
      if (cat !== 'all' && category !== cat) return false;

      if (!q) return true;

      const hay = [
        c?.name,
        c?.company,
        c?.category,
        c?.email,
        c?.phone,
        c?.notes
      ]
        .map((x) => String(x ?? '').toLowerCase())
        .join(' | ');

      return hay.includes(q);
    });
  },

  renderContactCards(contactList) {
    if (!contactList || contactList.length === 0) {
      return `
        <div class="col-span-full py-20 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-xl bg-white">
          <i class="fa fa-address-book text-4xl mb-3 opacity-20"></i>
          <p>No contacts found. Start building your network.</p>
        </div>
      `;
    }

    return contactList
      .map((contact) => {
        const categoryText = String(contact?.category || 'General');
        const categoryClass = this.getCategoryClass(categoryText);
        const initials = getInitials(contact?.name);

        const email = normalizeEmail(contact?.email);
        const phone = normalizePhone(contact?.phone);
        const notes = String(contact?.notes || '').trim();

        const emailEnabled = !!email;
        const phoneEnabled = !!phone;

        const emailHref = emailEnabled ? `mailto:${encodeURIComponent(email)}` : '#';
        const phoneHref = phoneEnabled ? `tel:${encodeURIComponent(phone)}` : '#';

        const disabledClass = 'opacity-40 pointer-events-none cursor-not-allowed';

        return `
          <div class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow group">
            <div class="p-5">
              <div class="flex justify-between items-start mb-4">
                <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${categoryClass}">
                  ${escapeHtml(categoryText)}
                </span>
                <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button data-action="contact-edit" data-id="${escapeHtml(contact.id)}" class="text-gray-400 hover:text-slate-600" title="Edit">
                    <i class="fa fa-pen text-xs"></i>
                  </button>
                  <button data-action="contact-delete" data-id="${escapeHtml(contact.id)}" class="text-gray-400 hover:text-red-500" title="Delete">
                    <i class="fa fa-trash text-xs"></i>
                  </button>
                </div>
              </div>

              <div class="text-center mb-4">
                <div class="w-16 h-16 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-xl font-bold mx-auto mb-2 border-2 border-white shadow-sm">
                  ${escapeHtml(initials)}
                </div>
                <h3 class="font-bold text-gray-900 text-lg">${escapeHtml(contact?.name || 'Unnamed')}</h3>
                <p class="text-xs text-gray-500 font-medium">${escapeHtml(contact?.company || 'Independent')}</p>
              </div>

              <div class="space-y-2 pt-4 border-t border-gray-50">
                <div
                  class="flex items-center text-sm text-gray-600 ${emailEnabled ? 'cursor-pointer hover:text-slate-900' : ''}"
                  data-action="${emailEnabled ? 'contact-copy-email' : ''}"
                  data-value="${emailEnabled ? escapeHtml(email) : ''}"
                  title="${emailEnabled ? 'Click to copy email' : ''}"
                >
                  <i class="fa fa-envelope w-5 text-gray-300"></i>
                  <span class="truncate">${escapeHtml(email || 'No email')}</span>
                  ${emailEnabled ? `<i class="fa fa-copy ml-2 text-xs text-gray-300 group-hover:text-gray-500"></i>` : ''}
                </div>

                <div
                  class="flex items-center text-sm text-gray-600 ${phoneEnabled ? 'cursor-pointer hover:text-slate-900' : ''}"
                  data-action="${phoneEnabled ? 'contact-copy-phone' : ''}"
                  data-value="${phoneEnabled ? escapeHtml(phone) : ''}"
                  title="${phoneEnabled ? 'Click to copy phone' : ''}"
                >
                  <i class="fa fa-phone w-5 text-gray-300"></i>
                  <span>${escapeHtml(phone || 'No phone')}</span>
                  ${phoneEnabled ? `<i class="fa fa-copy ml-2 text-xs text-gray-300 group-hover:text-gray-500"></i>` : ''}
                </div>

                ${
                  notes
                    ? `
                      <div class="text-xs text-slate-600 mt-2">
                        <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Notes</div>
                        <div class="line-clamp-3 whitespace-pre-wrap">${escapeHtml(notes)}</div>
                      </div>
                    `
                    : ''
                }
              </div>
            </div>

            <div class="bg-gray-50 px-5 py-3 flex gap-2">
              <a href="${emailHref}"
                 class="flex-grow text-center bg-white border border-gray-200 py-1.5 rounded text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors ${emailEnabled ? '' : disabledClass}"
                 ${emailEnabled ? '' : 'aria-disabled="true" tabindex="-1"'}
              >
                Email
              </a>
              <a href="${phoneHref}"
                 class="flex-grow text-center bg-white border border-gray-200 py-1.5 rounded text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors ${phoneEnabled ? '' : disabledClass}"
                 ${phoneEnabled ? '' : 'aria-disabled="true" tabindex="-1"'}
              >
                Call
              </a>
            </div>
          </div>
        `;
      })
      .join('');
  },

  bindEvents() {
    const container = document.getElementById('view-contacts');
    if (!container) return;

    if (this._bound) return;
    this._bound = true;

    if (!this._debouncedSearch) {
      this._debouncedSearch = debounce(() => this.render(this._lastState), 250);
    }

    // Delegated click handling
    container.addEventListener('click', async (e) => {
      const addBtn = e.target.closest('#add-contact-btn');
      if (addBtn) {
        this.showAddContactModal();
        return;
      }

      const resetBtn = e.target.closest('#contacts-reset');
      if (resetBtn) {
        this._filters = { q: '', category: 'all' };
        this.render(this._lastState);
        return;
      }

      // Copy actions: click on the row
      const copyRow = e.target.closest('[data-action="contact-copy-email"], [data-action="contact-copy-phone"]');
      if (copyRow) {
        const value = copyRow.dataset.value || '';
        const ok = await copyToClipboard(value);
        if (ok) showToast(`Copied: ${value}`, 'success');
        else showToast('Copy failed. Your browser may block clipboard access.', 'error');
        return;
      }

      const actionBtn = e.target.closest('[data-action]');
      if (!actionBtn) return;

      const action = actionBtn.dataset.action;
      const id = actionBtn.dataset.id;

      if (action === 'contact-delete') {
        this.confirmDelete(id);
      } else if (action === 'contact-edit') {
        this.openEditById(id);
      }
    });

    // Filter events (input/change)
    container.addEventListener('input', (e) => {
      const t = e.target;
      if (!t) return;

      if (t.id === 'contacts-q') {
        this._filters.q = t.value || '';
        this._debouncedSearch(); // debounce only search
      }
    });

    container.addEventListener('change', (e) => {
      const t = e.target;
      if (!t) return;

      if (t.id === 'contacts-category') {
        this._filters.category = t.value || 'all';
        this.render(this._lastState);
      }
    });
  },

  openEditById(id) {
    const contactsList = Array.isArray(this._lastState?.contacts) ? this._lastState.contacts : [];
    const contact = contactsList.find((c) => String(c?.id) === String(id));

    if (!contact) {
      modalManager.show(
        'Contact not found',
        `<p class="text-sm font-semibold text-slate-700">That contact could not be found. It may have been deleted or not synced yet.</p>`,
        () => true,
        { submitLabel: 'Close', hideCancel: true }
      );
      return;
    }

    this.showEditContactModal(contact);
  },

  confirmDelete(id) {
    modalManager.show(
      'Delete contact',
      `<p class="text-sm font-semibold text-slate-700">Delete this contact permanently? This cannot be undone.</p>`,
      () => {
        stateManager.delete('contacts', id);
        return true;
      },
      {
        submitLabel: 'Delete',
        cancelLabel: 'Cancel',
        danger: true
      }
    );
  },

  showAddContactModal() {
    const formHtml = buildContactFormHtml(null);

    modalManager.show(
      'Add New Contact',
      formHtml,
      () => {
        const name = String(document.getElementById('contact-name')?.value ?? '').trim();
        const company = String(document.getElementById('contact-company')?.value ?? '').trim();
        const category = String(document.getElementById('contact-category')?.value ?? 'General').trim();
        const phone = String(document.getElementById('contact-phone')?.value ?? '').trim();
        const email = String(document.getElementById('contact-email')?.value ?? '').trim();
        const notes = String(document.getElementById('contact-notes')?.value ?? '').trim();

        if (!name) throw new Error('Name is required.');

        const newContact = { name, company, category, phone, email, notes };
        stateManager.add('contacts', newContact);
        return true;
      },
      {
        submitLabel: 'Add Contact',
        cancelLabel: 'Cancel'
      }
    );
  },

  showEditContactModal(contact) {
    const formHtml = buildContactFormHtml(contact);

    modalManager.show(
      'Edit Contact',
      formHtml,
      () => {
        const name = String(document.getElementById('contact-name')?.value ?? '').trim();
        const company = String(document.getElementById('contact-company')?.value ?? '').trim();
        const category = String(document.getElementById('contact-category')?.value ?? 'General').trim();
        const phone = String(document.getElementById('contact-phone')?.value ?? '').trim();
        const email = String(document.getElementById('contact-email')?.value ?? '').trim();
        const notes = String(document.getElementById('contact-notes')?.value ?? '').trim();

        if (!name) throw new Error('Name is required.');

        const patch = { name, company, category, phone, email, notes };
        stateManager.update('contacts', contact.id, patch);
        return true;
      },
      {
        submitLabel: 'Save',
        cancelLabel: 'Cancel'
      }
    );
  },

  getCategoryClass(cat) {
    const c = String(cat ?? '').toLowerCase();
    if (c === 'broker') return 'bg-indigo-50 text-indigo-600';
    if (c === 'lender') return 'bg-emerald-50 text-emerald-600';
    if (c === 'attorney') return 'bg-slate-100 text-slate-600';
    if (c === 'property manager') return 'bg-orange-50 text-orange-600';
    if (c === 'contractor') return 'bg-amber-50 text-amber-700';
    if (c === 'insurance') return 'bg-sky-50 text-sky-700';
    return 'bg-gray-50 text-gray-500';
  }
};
