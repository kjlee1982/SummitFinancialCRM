/**
 * src/utils/modals.js
 * Standardized modal system (works with both:
 *  - separate siblings: #modal-backdrop + #modal-content (your current index.html)
 *  - nested content inside backdrop
 */

function ensureModalDom() {
  let backdrop = document.getElementById('modal-backdrop');
  let content = document.getElementById('modal-content');

  // If missing, create the "separate siblings" pattern (safe default)
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'modal-backdrop';
    backdrop.className = 'fixed inset-0 bg-black/50 hidden z-[100]';
    document.body.appendChild(backdrop);
  }

  if (!content) {
    content = document.createElement('div');
    content.id = 'modal-content';
    content.className = 'fixed inset-0 hidden z-[100] flex items-center justify-center p-4';
    document.body.appendChild(content);
  }

  return { backdrop, content };
}

function showLayer(backdrop, content) {
  // Show backdrop
  backdrop.classList.remove('hidden');

  // Show content layer
  content.classList.remove('hidden');

  // Force flex centering on the content layer (your index.html expects this)
  if (!content.classList.contains('flex')) content.classList.add('flex');

  // Ensure correct z-order if someone changed classes
  backdrop.style.zIndex = '100';
  content.style.zIndex = '101';
}

function hideLayer(backdrop, content) {
  backdrop.classList.add('hidden');
  content.classList.add('hidden');
  // keep DOM, clear content
  content.innerHTML = '';
  // cleanup inline styles (optional)
  backdrop.style.zIndex = '';
  content.style.zIndex = '';
}

function stop(e) { e.stopPropagation(); }

export const modalManager = {
  hide() {
    const { backdrop, content } = ensureModalDom();
    hideLayer(backdrop, content);
  },

  show(title, htmlContent, onSave, opts = {}) {
    const { backdrop, content } = ensureModalDom();

    // Build the modal card
    content.innerHTML = `
      <div class="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden" data-modal-card>
        <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h3 class="text-lg font-black text-slate-900">${title || ''}</h3>
          <button type="button" data-modal-action="close"
            class="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center">
            <i class="fa fa-xmark"></i>
          </button>
        </div>

        <div class="p-6">
          ${htmlContent || ''}
        </div>

        <div class="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2 bg-white">
          <button type="button" data-modal-action="close"
            class="px-4 py-2 rounded-xl bg-slate-100 text-slate-800 font-bold hover:bg-slate-200">
            Cancel
          </button>

          <button type="button" data-modal-action="save"
            class="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800">
            ${opts.saveText || 'Save'}
          </button>
        </div>
      </div>
    `;

    // Show both layers
    showLayer(backdrop, content);

    // Clicking backdrop closes
    backdrop.onclick = () => hideLayer(backdrop, content);

    // Clicking outside the card closes (on content layer)
    content.onclick = () => hideLayer(backdrop, content);

    // Clicking inside card does not close
    const card = content.querySelector('[data-modal-card]');
    if (card) card.addEventListener('click', stop);

    // Close buttons
    content.querySelectorAll('[data-modal-action="close"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        hideLayer(backdrop, content);
      });
    });

    // Save button
    const saveBtn = content.querySelector('[data-modal-action="save"]');
    if (saveBtn) {
      saveBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const formData = this.getFormData(content);

        try {
          const res = (typeof onSave === 'function') ? await onSave(formData) : true;
          // If explicitly returns false, keep modal open
          if (res === false) return;
          hideLayer(backdrop, content);
        } catch (err) {
          console.error('modal save failed', err);
          // keep open
        }
      });
    }

    // ESC closes
    const onEsc = (ev) => {
      if (ev.key === 'Escape') {
        hideLayer(backdrop, content);
        document.removeEventListener('keydown', onEsc);
      }
    };
    document.addEventListener('keydown', onEsc);

    return true;
  },

  confirm(title, message, onConfirm, opts = {}) {
    const danger = !!opts.danger;

    const html = `
      <div class="text-sm text-slate-700 whitespace-pre-wrap">${message || ''}</div>
      ${danger ? '<div class="mt-3 text-xs font-bold text-red-600 uppercase tracking-widest">Danger</div>' : ''}
    `;

    return this.show(
      title,
      html,
      async () => {
        const res = await (onConfirm?.());
        return res !== false;
      },
      { saveText: opts.confirmText || (danger ? 'Confirm' : 'OK') }
    );
  },

  alert({ title = 'Notice', message = '' } = {}) {
    const html = `<div class="text-sm text-slate-700 whitespace-pre-wrap">${message}</div>`;
    return this.show(title, html, () => true, { saveText: 'OK' });
  },

  getFormData(container) {
    const data = {};
    container.querySelectorAll('input, select, textarea').forEach(el => {
      if (!el.id) return;
      if (el.type === 'checkbox') data[el.id] = !!el.checked;
      else data[el.id] = el.value;
    });
    return data;
  }
};
