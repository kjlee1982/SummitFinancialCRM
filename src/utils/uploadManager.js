import { auth, storage } from '../firebase.js';
import { stateManager } from '../state.js';
import {
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

function makeId(prefix = 'upl') {
  try {
    if (crypto?.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  } catch (_) {}
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function safeFileName(name) {
  const base = String(name || 'file').trim();
  return base.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

function readSelectedId(key) {
  try {
    const v = sessionStorage.getItem(key);
    return v ? String(v) : null;
  } catch (_) {
    return null;
  }
}

function inferContextFromState() {
  return {
    dealId: readSelectedId('selected_deal_id'),
    propertyId: readSelectedId('selected_property_id'),
    investorId: readSelectedId('selected_investor_id'),
    llcId: readSelectedId('selected_llc_id'),
    projectId: readSelectedId('selected_project_id')
  };
}

function getNameById(listName, id) {
  if (!id) return null;
  const s = stateManager.get();
  const list = Array.isArray(s[listName]) ? s[listName] : [];
  const hit = list.find(x => String(x?.id) === String(id));
  return hit?.name || null;
}

function contextLabel(ctx) {
  const parts = [];
  if (ctx.dealId) parts.push(`Deal: ${getNameById('deals', ctx.dealId) || ctx.dealId}`);
  if (ctx.propertyId) parts.push(`Property: ${getNameById('properties', ctx.propertyId) || ctx.propertyId}`);
  if (ctx.investorId) parts.push(`Investor: ${getNameById('investors', ctx.investorId) || ctx.investorId}`);
  if (ctx.llcId) parts.push(`LLC: ${getNameById('llcs', ctx.llcId) || ctx.llcId}`);
  if (ctx.projectId) parts.push(`Project: ${getNameById('projects', ctx.projectId) || ctx.projectId}`);
  return parts.length ? parts.join(' / ') : 'Global';
}

function buildStoragePath(userId, uploadId, fileName, ctx) {
  const safe = safeFileName(fileName);
  const ctxParts = [];
  if (ctx?.dealId) ctxParts.push(`deal_${ctx.dealId}`);
  if (ctx?.propertyId) ctxParts.push(`property_${ctx.propertyId}`);
  if (ctx?.investorId) ctxParts.push(`investor_${ctx.investorId}`);
  if (ctx?.llcId) ctxParts.push(`llc_${ctx.llcId}`);
  if (ctx?.projectId) ctxParts.push(`project_${ctx.projectId}`);
  const ctxFolder = ctxParts.length ? ctxParts.join('__') : 'global';

  return `users/${userId}/uploads/${ctxFolder}/${uploadId}__${safe}`;
}

function addProgressRow(host, file) {
  const row = document.createElement('div');
  row.className = 'mt-3 rounded-xl border border-slate-200 p-3 bg-slate-50';
  row.innerHTML = `
    <div class="flex items-center justify-between gap-3">
      <div class="min-w-0">
        <div class="text-sm font-black text-slate-900 truncate">${safeFileName(file?.name || 'file')}</div>
        <div class="text-xs text-slate-500" data-role="status">Queued</div>
      </div>
      <div class="text-xs font-black text-slate-600" data-role="pct">0%</div>
    </div>
    <div class="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
      <div class="h-2 rounded-full bg-slate-900" data-role="bar" style="width:0%"></div>
    </div>
  `;
  host.appendChild(row);

  const pctEl = row.querySelector('[data-role="pct"]');
  const barEl = row.querySelector('[data-role="bar"]');
  const statusEl = row.querySelector('[data-role="status"]');

  return {
    set(pct, statusText) {
      const p = Math.max(0, Math.min(100, Math.round(pct || 0)));
      if (pctEl) pctEl.textContent = `${p}%`;
      if (barEl) barEl.style.width = `${p}%`;
      if (statusEl && statusText) statusEl.textContent = statusText;
    },
    done(url) {
      if (pctEl) pctEl.textContent = '100%';
      if (barEl) barEl.style.width = '100%';
      if (statusEl) {
        statusEl.innerHTML = url
          ? `Uploaded - <a class="text-blue-600 hover:underline" href="${url}" target="_blank" rel="noopener noreferrer">Open</a>`
          : 'Uploaded';
      }
    },
    error(msg) {
      if (statusEl) statusEl.textContent = msg || 'Upload failed';
      row.classList.add('border-red-300', 'bg-red-50');
    }
  };
}

async function uploadFile(file, ctx, progress) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  if (!file) throw new Error('No file');

  const uploadId = makeId('upl');
  const path = buildStoragePath(user.uid, uploadId, file.name, ctx);
  const refObj = storageRef(storage, path);

  const metadata = {
    contentType: file.type || 'application/octet-stream',
    customMetadata: {
      ...(ctx?.dealId ? { dealId: String(ctx.dealId) } : {}),
      ...(ctx?.propertyId ? { propertyId: String(ctx.propertyId) } : {}),
      ...(ctx?.investorId ? { investorId: String(ctx.investorId) } : {}),
      ...(ctx?.llcId ? { llcId: String(ctx.llcId) } : {}),
      ...(ctx?.projectId ? { projectId: String(ctx.projectId) } : {})
    }
  };

  return await new Promise((resolve, reject) => {
    const task = uploadBytesResumable(refObj, file, metadata);

    task.on(
      'state_changed',
      (snap) => {
        const pct = snap.totalBytes ? (snap.bytesTransferred / snap.totalBytes) * 100 : 0;
        progress?.set(pct, 'Uploading');
      },
      (err) => {
        progress?.error(err?.message || 'Upload failed');
        reject(err);
      },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);

        const rec = {
          id: uploadId,
          name: file.name,
          size: file.size,
          type: file.type,
          url,
          path,
          created_at: new Date().toISOString(),
          meta: {
            dealId: ctx?.dealId || null,
            propertyId: ctx?.propertyId || null,
            investorId: ctx?.investorId || null,
            llcId: ctx?.llcId || null,
            projectId: ctx?.projectId || null
          }
        };

        await stateManager.add('uploads', rec);
        progress?.done(url);
        resolve(rec);
      }
    );
  });
}

async function deleteUpload(id) {
  if (!id) return false;

  const s = stateManager.get();
  const list = Array.isArray(s.uploads) ? s.uploads : [];
  const u = list.find(x => String(x?.id) === String(id));

  if (u?.path) {
    try {
      await deleteObject(storageRef(storage, u.path));
    } catch (e) {
      console.warn('[Uploads] Storage delete failed (continuing):', e);
    }
  }

  await stateManager.delete('uploads', id);
  return true;
}

function renderDropzone(mountId, ctx) {
  const host = typeof mountId === 'string' ? document.getElementById(mountId) : mountId;
  if (!host) return;

  host.innerHTML = `
    <div class="rounded-2xl border-2 border-dashed border-slate-200 p-5 bg-slate-50" data-role="dropzone">
      <div class="flex items-center justify-between gap-4">
        <div>
          <div class="text-sm font-black text-slate-900">Drag files here</div>
          <div class="text-xs text-slate-500 mt-0.5">or click to choose files</div>
        </div>
        <button class="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm font-black" data-role="pick">Choose</button>
      </div>
      <input data-role="input" type="file" class="hidden" multiple />
      <div data-role="progress"></div>
    </div>
  `;

  const dropzone = host.querySelector('[data-role="dropzone"]');
  const input = host.querySelector('[data-role="input"]');
  const pickBtn = host.querySelector('[data-role="pick"]');
  const progressHost = host.querySelector('[data-role="progress"]');

  const handleFiles = async (files) => {
    const arr = Array.from(files || []);
    if (!arr.length) return;

    for (const f of arr) {
      const prog = addProgressRow(progressHost, f);
      try {
        await uploadFile(f, ctx, prog);
      } catch (e) {
        prog.error(e?.message || 'Upload failed');
      }
    }
  };

  pickBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    input?.click();
  });

  dropzone?.addEventListener('click', () => input?.click());

  input?.addEventListener('change', (e) => {
    handleFiles(e.target.files);
    e.target.value = '';
  });

  dropzone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('border-slate-400');
  });

  dropzone?.addEventListener('dragleave', () => {
    dropzone.classList.remove('border-slate-400');
  });

  dropzone?.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('border-slate-400');
    handleFiles(e.dataTransfer?.files);
  });
}

export const uploadManager = {
  inferContextFromState,
  contextLabel,
  buildStoragePath,
  renderDropzone,
  uploadFile,
  deleteUpload
};
