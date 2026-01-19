/**
 * src/utils/modals.js
 * Standardized system for all Add/Edit forms and detail popups.
 *
 * Backward-compatible:
 *   modalManager.show(title, htmlContent, onSave)
 *
 * Enhanced:
 *   modalManager.show(title, htmlContent, onSave, {
 *     submitLabel: "OK",
 *     cancelLabel: "Cancel",
 *     hideCancel: true,
 *     danger: true,
 *     showClose: true
 *   })
 */

export const modalManager = {
  /**
   * @param {string} title
   * @param {string} htmlContent
   * @param {(formData: object) => (boolean|void|Promise<boolean|void>)} onSave
   *        - return false to block closing
   *        - throw to display error message and block closing
   * @param {object} options
   */
  show(title, htmlContent, onSave, options = {}) {
    const backdrop = document.getElementById('modal-backdrop');
    const content = document.getElementById('modal-content');

    if (!backdrop || !content) {
      console.warn('modalManager.show: missing modal DOM elements');
      return;
    }

    const {
      submitLabel = 'Save Changes',
      cancelLabel = 'Cancel',
      hideCancel = false,
      danger = false,
      showClose = true,
      submitId = 'modal-submit',
      cancelId = 'modal-cancel'
    } = options;

    content.innerHTML = `
      <div class="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 rounded-t-2xl">
        <h3 id="modal-title" class="text-xl font-bold text-gray-800"></h3>
        ${
          showClose
            ? `
              <button id="modal-close" class="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close modal">
                <i class="fa fa-times text-xl"></i>
              </button>
            `
            : `<div></div>`
        }
      </div>

      <div class="p-8">
        ${htmlContent}

        <p id="modal-error" class="hidden mt-4 text-sm text-red-600 font-semibold"></p>

        <div class="mt-8 flex justify-end gap-3">
          <button id="${cancelId}" class="px-6 py-2.5 rounded-lg text-gray-500 font-semibold hover:bg-gray-100 transition-all">
            ${cancelLabel}
          </button>
          <button id="${submitId}"
            class="px-6 py-2.5 rounded-lg font-bold transition-all shadow-md
              ${danger ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-slate-900 hover:bg-slate-800 text-white'}">
            ${submitLabel}
          </button>
        </div>
      </div>
    `;

    // Title safe-set (prevents injection)
    const titleEl = content.querySelector('#modal-title');
    if (titleEl) titleEl.textContent = title ?? '';

    // Show modal
    backdrop.classList.remove('hidden');
    backdrop.classList.add('flex');

    const errorEl = content.querySelector('#modal-error');
    const submitBtn = content.querySelector(`#${submitId}`);
    const cancelBtn = content.querySelector(`#${cancelId}`);
    const closeBtn = content.querySelector('#modal-close');

    // Hide cancel if requested
    if (hideCancel && cancelBtn) cancelBtn.classList.add('hidden');

    const close = () => {
      backdrop.classList.add('hidden');
      backdrop.classList.remove('flex');
      content.innerHTML = '';
    };

    // Close handlers
    closeBtn?.addEventListener('click', close);
    cancelBtn?.addEventListener('click', close);

    // Backdrop click closes modal (clicking inside doesn't)
    // Use { once:true } so we don't accumulate listeners across renders.
    backdrop.addEventListener(
      'click',
      (e) => {
        if (e.target === backdrop) close();
      },
      { once: true }
    );

    // Submit handler (async-safe)
    submitBtn?.addEventListener('click', async () => {
      if (!submitBtn) return;

      // Prevent double submit
      submitBtn.disabled = true;
      const originalHtml = submitBtn.innerHTML;
      submitBtn.innerHTML = `<i class="fa fa-circle-notch fa-spin mr-2"></i> Working...`;

      if (errorEl) {
        errorEl.textContent = '';
        errorEl.classList.add('hidden');
      }

      try {
        const formData = this.getFormData(content);

        // onSave can be async; return false to keep modal open
        const result = await onSave(formData);
        if (result === false) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalHtml;
          return;
        }

        close();
      } catch (err) {
        console.error('modalManager: onSave failed', err);

        if (errorEl) {
          // If caller threw a useful message, show it; else show generic
          const msg = err?.message ? String(err.message) : 'Could not complete the action. Please try again.';
          errorEl.textContent = msg;
          errorEl.classList.remove('hidden');
        }

        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHtml;
      }
    });
  },

  /**
   * Automatically extracts input values into a JSON object.
   * - Uses id if present, otherwise name.
   * - Supports checkbox/radio.
   * - Coerces number inputs to numbers when valid.
   */
  getFormData(container) {
    const data = {};
    container.querySelectorAll('input, select, textarea').forEach((el) => {
      const key = el.id || el.name;
      if (!key) return;

      if (el.tagName === 'INPUT') {
        const type = (el.getAttribute('type') || '').toLowerCase();

        if (type === 'checkbox') {
          data[key] = el.checked;
          return;
        }

        if (type === 'radio') {
          if (el.checked) data[key] = el.value;
          return;
        }

        if (type === 'number') {
          const n = parseFloat(el.value);
          data[key] = Number.isFinite(n) ? n : el.value; // keep raw if invalid/empty
          return;
        }
      }

      data[key] = el.value;
    });

    return data;
  }
};
