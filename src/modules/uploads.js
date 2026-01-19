/**
 * src/modules/uploads.js
 * Compatibility wrapper: guarantees exports with a .render() function.
 *
 * Exports:
 *  - uploads        (preferred)
 *  - uploadManager  (backward-compatible alias)
 */

// If you already have an internal render function name, import it here.
// Otherwise, implement render below.
function getHost() {
  return document.getElementById('view-uploads');
}

function ensureBaseUI(host) {
  // If your module already injects UI elsewhere, you can remove this shell.
  // This makes sure "Uploads" view doesn't render blank.
  host.innerHTML = `
    <div class="p-6 md:p-8">
      <div class="flex items-center justify-between mb-6">
        <div>
          <div class="text-2xl font-black text-slate-900">Uploads</div>
          <div class="text-sm text-slate-500">Upload and organize documents for deals, properties, investors, and entities.</div>
        </div>
      </div>

      <div class="rounded-2xl border border-slate-200 bg-white p-6">
        <div class="text-sm text-slate-700">
          Uploads module is connected, but your internal UI renderer hasn’t been wired into this wrapper yet.
        </div>
        <div class="mt-3 text-xs text-slate-500">
          If you already have a render function in this file, rename it to <span class="font-mono">render()</span> or map it inside this wrapper.
        </div>
      </div>
    </div>
  `;
}

function bindOnce(host) {
  if (host.__uploadsBound) return;
  host.__uploadsBound = true;

  // Delegated handlers go here if needed later
  host.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-upload-action]');
    if (!btn) return;
    // handle actions...
  });
}

function render() {
  const host = getHost();
  if (!host) return;

  bindOnce(host);

  // If you already have a real renderer in THIS file, call it here.
  // Example: realRender(host);
  ensureBaseUI(host);
}

/** Preferred export */
export const uploads = { render };

/** Backward-compatible export name */
export const uploadManager = uploads;
