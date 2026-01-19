/**
 * src/utils/modals.js
 * Standardized modal system (self-healing).
 */

function ensureModalDom() {
  let backdrop = document.getElementById('modal-backdrop');
  let content = document.getElementById('modal-content');

  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'modal-backdrop';
    backdrop.className = 'fixed inset-0 z-[80] bg-slate-900/60 backdrop-blur-sm hidden items-center justify-center p-4';
    document.body.appendChild(backdrop);
  }

  if (!content) {
    content = document.createElement('div');
    content.id = 'modal-content';
    content.className = 'bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden transform transition-all';
    backdrop.appendChild(content);
  }

  return { backdrop, content };
}

function closeModal(backdrop) {
  backdrop.classList.add('hidden');
  backdrop.classList.remove('flex');
}

export const modalManager = {
  show(title, htmlContent, onSave) {
    const { backdrop, content } = ensureModalDom();

    content.innerHTML = `
      <div class="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-2xl">
        <h3 class="text-xl font-bold text-gray-800">${title || ''}</h3>
        <button id="modal-close" class="text-gray-400 hover:text-gray-600 transition-colors">
          <i class="fa fa-times text-xl"></i>
        </button>
      </div>
      <div class="p-8">
        ${htmlContent}
        <div class="mt-8 flex justify-end gap-3">
          <button id="modal-cancel" class="px-6 py-2.5 rounded-lg text-gray-500 font-semibold hover:bg-gray-100 transition-all">
            Cancel
          </button>
          <button id="modal-submit" class="px-6 py-2.5 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition-all shadow-md">
            Save Changes
          </button>
        </div>
      </div>
    `;

    backdrop.classList.remove('hidden');
    backdrop.classList.add('flex');

    // Click outside closes
    backdrop.onclick = (e) => {
      if (e.target === backdrop) closeModal(backdrop);
    };

    const btnClose = content.querySelector('#modal-close');
    const btnCancel = content.querySelector('#modal-cancel');
    const btnSubmit = content.querySelector('#modal-submit');

    btnClose && (btnClose.onclick = () => closeModal(backdrop));
    btnCancel && (btnCancel.onclick = () => closeModal(backdrop));

    btnSubmit && (btnSubmit.onclick = async () => {
      const formData = this.getFormData(content);

      // If onSave returns false, keep modal open
      try {
        const res = (typeof onSave === 'function') ? await onSave(formData) : true;
        if (res === false) return;
        closeModal(backdrop);
      } catch (e) {
        console.error('modal save failed', e);
        // keep open
      }
    });

    return true;
  },

  confirm(title, message, onConfirm, opts = {}) {
    const danger = !!opts.danger;
    const confirmText = opts.confirmText || 'Confirm';

    const html = `
      <div class="text-sm text-gray-600 whitespace-pre-wrap">${message || ''}</div>
    `;

    return this.show(title, html, async () => {
      const res = await (onConfirm?.());
      return res !== false;
    }, danger, confirmText);
  },

  getFormData(container) {
    const data = {};
    container.querySelectorAll('input, select, textarea').forEach(el => {
      if (el.id) data[el.id] = el.value;
    });
    return data;
  }
};
