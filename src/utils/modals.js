/**
 * src/modals.js
 * Robust modal manager that supports BOTH ID styles:
 * - modal-backdrop / modal-content
 * - modalBackdrop / modalContent
 */

function getModalEls() {
  const backdrop =
    document.getElementById('modal-backdrop') ||
    document.getElementById('modalBackdrop');

  const content =
    document.getElementById('modal-content') ||
    document.getElementById('modalContent');

  return { backdrop, content };
}

function esc(s) {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function showShell({ title, bodyHtml, footerHtml }) {
  const { backdrop, content } = getModalEls();
  if (!backdrop || !content) {
    console.error('modalManager.show: missing modal DOM elements');
    return false;
  }

  backdrop.classList.remove('hidden');
  content.classList.remove('hidden');

  content.innerHTML = `
    <div class="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
      <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
        <div class="text-lg font-black text-slate-900">${esc(title || '')}</div>
        <button data-modal-action="close" class="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center">
          <i class="fa fa-xmark"></i>
        </button>
      </div>
      <div class="p-6">${bodyHtml || ''}</div>
      <div class="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-2">
        ${footerHtml || ''}
      </div>
    </div>
  `;

  // Close handlers
  const close = () => hide();

  backdrop.onclick = close;

  content.querySelectorAll('[data-modal-action="close"]').forEach(el => {
    el.onclick = close;
  });

  document.addEventListener('keydown', onEscOnce, { once: true });
  function onEscOnce(ev) {
    if (ev.key === 'Escape') hide();
  }

  return true;
}

function hide() {
  const { backdrop, content } = getModalEls();
  if (backdrop) backdrop.classList.add('hidden');
  if (content) {
    content.classList.add('hidden');
    content.innerHTML = '';
  }
}

export const modalManager = {
  hide,

  alert({ title = 'Notice', message = '' } = {}) {
    return showShell({
      title,
      bodyHtml: `<div class="text-sm text-slate-700 whitespace-pre-wrap">${esc(message)}</div>`,
      footerHtml: `
        <button data-modal-action="close"
          class="px-4 py-2 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800">
          OK
        </button>
      `
    });
  },

  confirm({
    title = 'Confirm',
    message = '',
    danger = false,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    onConfirm
  } = {}) {
    const okBtnClass = danger
      ? 'bg-red-600 hover:bg-red-700'
      : 'bg-slate-900 hover:bg-slate-800';

    const shown = showShell({
      title,
      bodyHtml: `<div class="text-sm text-slate-700 whitespace-pre-wrap">${esc(message)}</div>`,
      footerHtml: `
        <button data-modal-action="close"
          class="px-4 py-2 rounded-xl bg-slate-100 text-slate-800 font-bold hover:bg-slate-200">
          ${esc(cancelText)}
        </button>
        <button id="modal-confirm-btn"
          class="px-4 py-2 rounded-xl text-white font-bold ${okBtnClass}">
          ${esc(confirmText)}
        </button>
      `
    });

    if (!shown) return false;

    const confirmBtn = document.getElementById('modal-confirm-btn');
    if (confirmBtn) {
      confirmBtn.onclick = async () => {
        try {
          const res = await (onConfirm?.());
          // If explicitly returns false, keep modal open
          if (res === false) return;
          hide();
        } catch (e) {
          console.error('modal confirm failed', e);
          // Keep open so user can try again
        }
      };
    }
    return true;
  }
};
