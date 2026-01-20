/**
 * src/modules/crexi.js
 * Crexi Search Launcher (Option 1)
 *
 * IMPORTANT: This module does NOT scrape Crexi. It only stores and launches URLs.
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

function cleanStr(s) {
  return String(s ?? '').trim();
}

function toNum(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

function toInt(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

function titleCase(s) {
  const t = cleanStr(s);
  if (!t) return '';
  return t
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function normalizeStateCode(s) {
  const t = cleanStr(s).toUpperCase();
  if (t.length === 2) return t;
  return t.slice(0, 2);
}

function fmtMoneyShort(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '';
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${v}`;
}

function getParamArray(sp, key) {
  // Crexi uses both: key=value and key[]=value
  const a = sp.getAll(key);
  const b = sp.getAll(`${key}[]`);
  return [...a, ...b].filter(Boolean);
}

function parseCrexiUrl(rawUrl) {
  const raw = cleanStr(rawUrl);
  if (!raw) return { ok: false, error: 'Paste a Crexi URL first.' };

  let u;
  try {
    u = new URL(raw);
  } catch (_) {
    return { ok: false, error: 'That URL is not valid.' };
  }

  const host = (u.hostname || '').toLowerCase();
  if (!host.includes('crexi.com')) {
    return { ok: false, error: 'This does not look like a Crexi URL (crexi.com).' };
  }

  const sp = u.searchParams;

  const types = getParamArray(sp, 'types');
  const classes = getParamArray(sp, 'classes');
  const tradingStatuses = getParamArray(sp, 'tradingStatuses');
  const placeIds = getParamArray(sp, 'placeIds');

  const pageSize = toInt(sp.get('pageSize'));
  const capRateMin = toNum(sp.get('capRateMin'));
  const capRateMax = toNum(sp.get('capRateMax'));

  const askingPriceMin = toInt(sp.get('askingPriceMin'));
  const askingPriceMax = toInt(sp.get('askingPriceMax'));

  const occupancyMin = toNum(sp.get('occupancyMin'));
  const occupancyMax = toNum(sp.get('occupancyMax'));

  const unitMin = toInt(sp.get('unitMin'));
  const unitMax = toInt(sp.get('unitMax'));
  const unitType = cleanStr(sp.get('unitType'));

  const excludeUnpriced = cleanStr(sp.get('excludeUnpriced')) === 'true';

  const mapCenter = cleanStr(sp.get('mapCenter'));
  const mapZoom = toInt(sp.get('mapZoom'));

  const chips = [];

  if (types.length) chips.push(`Type: ${types.join(', ')}`);
  if (classes.length) chips.push(`Class: ${classes.join(', ')}`);
  if (askingPriceMin != null || askingPriceMax != null) {
    const left = askingPriceMin != null ? fmtMoneyShort(askingPriceMin) : '';
    const right = askingPriceMax != null ? fmtMoneyShort(askingPriceMax) : '';
    chips.push(`Price: ${left}${left && right ? '–' : ''}${right}`);
  }
  if (unitMin != null || unitMax != null) {
    const left = unitMin != null ? `${unitMin}` : '';
    const right = unitMax != null ? `${unitMax}` : '';
    const ut = unitType ? ` ${unitType}` : '';
    chips.push(`Units: ${left}${left && right ? '–' : ''}${right}${ut}`.trim());
  }
  if (capRateMin != null || capRateMax != null) {
    const left = capRateMin != null ? `${capRateMin}%` : '';
    const right = capRateMax != null ? `${capRateMax}%` : '';
    chips.push(`Cap: ${left}${left && right ? '–' : ''}${right}`);
  }
  if (occupancyMin != null || occupancyMax != null) {
    const left = occupancyMin != null ? `${occupancyMin}%` : '';
    const right = occupancyMax != null ? `${occupancyMax}%` : '';
    chips.push(`Occ: ${left}${left && right ? '–' : ''}${right}`);
  }
  if (excludeUnpriced) chips.push('Exclude unpriced');
  if (tradingStatuses.length) chips.push(`Status: ${tradingStatuses.join(' / ')}`);
  if (pageSize != null) chips.push(`Page: ${pageSize}`);

  // show placeIds count but not the raw id (we keep that in the form)
  if (placeIds.length) chips.push(`Place ID(s): ${placeIds.length}`);

  return {
    ok: true,
    url: u.toString(),
    host,
    pathname: u.pathname,
    placeIds,
    mapCenter,
    mapZoom,
    parsed: {
      types,
      classes,
      tradingStatuses,
      pageSize,
      capRateMin,
      capRateMax,
      askingPriceMin,
      askingPriceMax,
      occupancyMin,
      occupancyMax,
      unitMin,
      unitMax,
      unitType,
      excludeUnpriced
    },
    chips
  };
}

function buildLocationLabel(city, state) {
  const c = titleCase(city);
  const s = normalizeStateCode(state);
  if (!c && !s) return '';
  if (c && s) return `${c}, ${s}`;
  return c || s;
}

function parseTags(tagsText) {
  return cleanStr(tagsText)
    .split(',')
    .map(x => cleanStr(x))
    .filter(Boolean)
    .slice(0, 25);
}

const DEFAULT_TEMPLATES = [
  {
    id: 'tmpl_nationwide',
    title: 'Nationwide (MF)',
    label: 'Not location specific',
    city: '',
    state: '',
    url: 'https://www.crexi.com/properties?types%5B%5D=Multifamily&pageSize=60&capRateMin=7.5&mapCenter=36.23164877276338,-91.60924173444431&mapZoom=4&askingPriceMin=1000000&classes%5B%5D=C&classes%5B%5D=B&excludeUnpriced=true&occupancyMin=70&tradingStatuses%5B%5D=Call%20For%20Offers&tradingStatuses%5B%5D=Highest%20%26%20Best&tradingStatuses%5B%5D=On-Market&askingPriceMax=4000000&unitMax=100&unitMin=10&unitType=Units'
  },
  {
    id: 'tmpl_boise',
    title: 'Boise, ID',
    label: 'Your Boise search',
    city: 'Boise',
    state: 'ID',
    url: 'https://www.crexi.com/properties?types%5B%5D=Multifamily&pageSize=60&capRateMin=7.5&askingPriceMin=1000000&classes%5B%5D=C&classes%5B%5D=B&excludeUnpriced=true&occupancyMin=70&tradingStatuses%5B%5D=Call%20For%20Offers&tradingStatuses%5B%5D=Highest%20%26%20Best&tradingStatuses%5B%5D=On-Market&askingPriceMax=4000000&unitMax=100&unitMin=10&unitType=Units&placeIds%5B%5D=ChIJnbRH6XLxrlQRm51nNpuYW5o&mapZoom=3&mapCenter=0,2.499999999999991'
  },
  {
    id: 'tmpl_idahofalls',
    title: 'Idaho Falls, ID',
    label: 'Your Idaho Falls search',
    city: 'Idaho Falls',
    state: 'ID',
    url: 'https://www.crexi.com/properties?types%5B%5D=Multifamily&pageSize=60&capRateMin=7.5&askingPriceMin=1000000&classes%5B%5D=C&classes%5B%5D=B&excludeUnpriced=true&occupancyMin=70&tradingStatuses%5B%5D=Call%20For%20Offers&tradingStatuses%5B%5D=Highest%20%26%20Best&tradingStatuses%5B%5D=On-Market&askingPriceMax=4000000&unitMax=100&unitMin=10&unitType=Units&placeIds%5B%5D=ChIJtRKVc05ZVFMRyUlMCfzJESM&mapCenter=36.23164877276338,-91.60924173444431&mapZoom=3'
  }
];

export const crexi = {
  _bound: false,
  _editingId: null,
  _lastParse: null,
  _draft: {
    name: '',
    url: '',
    city: '',
    state: '',
    tagsText: 'mf',
    notes: ''
  },

  render() {
    const container = document.getElementById('view-crexi');
    if (!container) return;

    const state = stateManager.get();
    const presets = Array.isArray(state.crexiPresets) ? state.crexiPresets : [];
    const placeLabels = state?.settings?.crexiPlaceLabels || {};

    const parseResult = this._lastParse?.ok ? this._lastParse : parseCrexiUrl(this._draft.url);
    const hasParse = !!parseResult?.ok;

    const locationLabel = buildLocationLabel(this._draft.city, this._draft.state);

    container.innerHTML = `
      <div class="p-6">
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-2xl font-black text-slate-900">Crexi Search</h2>
              <span class="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-slate-900 text-white">Launcher</span>
              ${this._editingId ? `<span class="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-orange-600 text-white">Editing</span>` : ''}
            </div>
            <p class="text-sm text-slate-500 font-semibold mt-1">Save search URLs as presets. No scraping — just fast repeatable launch + labeling.</p>
          </div>

          <div class="flex items-center gap-2">
            <button data-action="crexi-clear"
              class="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-black text-sm">
              <i class="fa fa-eraser mr-2"></i>Clear
            </button>
            <button data-action="crexi-save"
              class="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-sm">
              <i class="fa fa-floppy-disk mr-2"></i>${this._editingId ? 'Save Changes' : 'Save Preset'}
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <!-- Left: Builder -->
          <div class="xl:col-span-1">
            <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div class="px-5 py-4 border-b border-slate-200 bg-slate-50">
                <h3 class="font-black text-slate-900">Preset Builder</h3>
                <p class="text-xs text-slate-500 font-semibold mt-1">Paste a Crexi URL, optionally label City/State, then save.</p>
              </div>

              <div class="p-5 space-y-4">
                <div>
                  <label class="text-xs font-black uppercase tracking-widest text-slate-500">Preset name</label>
                  <input id="crexi_name" value="${escapeHtml(this._draft.name)}"
                    class="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold"
                    placeholder="MF B/C $1–4M | 10–100u | Cap≥7.5 | Occ≥70" />
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label class="text-xs font-black uppercase tracking-widest text-slate-500">City</label>
                    <input id="crexi_city" value="${escapeHtml(this._draft.city)}"
                      class="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold"
                      placeholder="Boise" />
                  </div>
                  <div>
                    <label class="text-xs font-black uppercase tracking-widest text-slate-500">State</label>
                    <input id="crexi_state" value="${escapeHtml(this._draft.state)}"
                      class="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold"
                      placeholder="ID" />
                  </div>
                </div>

                <div>
                  <label class="text-xs font-black uppercase tracking-widest text-slate-500">Tags (comma-separated)</label>
                  <input id="crexi_tags" value="${escapeHtml(this._draft.tagsText)}"
                    class="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold"
                    placeholder="mf, idaho, value-add" />
                </div>

                <div>
                  <label class="text-xs font-black uppercase tracking-widest text-slate-500">Crexi URL</label>
                  <textarea id="crexi_url" rows="4"
                    class="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold"
                    placeholder="https://www.crexi.com/properties?...">${escapeHtml(this._draft.url)}</textarea>

                  <div class="mt-2 flex items-center gap-2">
                    <button data-action="crexi-parse"
                      class="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-black text-xs">
                      <i class="fa fa-wand-magic-sparkles mr-2"></i>Parse & Preview
                    </button>

                    ${hasParse ? `
                      <button data-action="crexi-open-draft"
                        class="px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 font-black text-xs">
                        <i class="fa fa-arrow-up-right-from-square mr-2"></i>Open Draft
                      </button>
                      <button data-action="crexi-copy-draft"
                        class="px-3 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 font-black text-xs">
                        <i class="fa fa-copy mr-2"></i>Copy URL
                      </button>
                    ` : ''}
                  </div>

                  ${parseResult?.ok ? `
                    <div class="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <div class="flex items-center justify-between">
                        <div class="text-xs font-black uppercase tracking-widest text-slate-500">Preview</div>
                        <div class="text-xs font-black text-slate-900">${escapeHtml(locationLabel || 'No location label')}</div>
                      </div>
                      <div class="mt-2 flex flex-wrap gap-2">
                        ${parseResult.chips.map(c => `<span class="text-[11px] font-black px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-800">${escapeHtml(c)}</span>`).join('')}
                      </div>
                      ${parseResult.placeIds?.length ? `
                        <div class="mt-3 text-xs text-slate-600">
                          <span class="font-black">Place ID(s):</span>
                          <span class="font-mono break-all">${escapeHtml(parseResult.placeIds.join(', '))}</span>
                        </div>
                        ${this.renderPlaceIdHints(parseResult.placeIds, placeLabels)}
                      ` : ''}
                    </div>
                  ` : parseResult?.error ? `
                    <div class="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold">
                      <i class="fa fa-triangle-exclamation mr-2"></i>${escapeHtml(parseResult.error)}
                    </div>
                  ` : ''}
                </div>

                <div>
                  <label class="text-xs font-black uppercase tracking-widest text-slate-500">Notes</label>
                  <textarea id="crexi_notes" rows="3"
                    class="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold"
                    placeholder="Optional notes...">${escapeHtml(this._draft.notes)}</textarea>
                </div>
              </div>
            </div>

            <div class="mt-6 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div class="px-5 py-4 border-b border-slate-200 bg-slate-50">
                <h3 class="font-black text-slate-900">Templates</h3>
                <p class="text-xs text-slate-500 font-semibold mt-1">Click to load one of your baseline searches into the builder.</p>
              </div>

              <div class="p-5 space-y-3">
                ${DEFAULT_TEMPLATES.map(t => `
                  <div class="p-4 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition-all">
                    <div class="flex items-start justify-between gap-3">
                      <div>
                        <div class="font-black text-slate-900">${escapeHtml(t.title)}</div>
                        <div class="text-xs text-slate-500 font-semibold">${escapeHtml(t.label)}</div>
                      </div>
                      <button data-action="crexi-template-use" data-id="${escapeHtml(t.id)}"
                        class="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs">
                        Use
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- Right: Presets -->
          <div class="xl:col-span-2">
            <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div class="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
                <div>
                  <h3 class="font-black text-slate-900">Saved Presets</h3>
                  <p class="text-xs text-slate-500 font-semibold mt-1">${presets.length} preset(s) saved.</p>
                </div>
              </div>

              <div class="p-5">
                ${presets.length ? `
                  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${presets.map(p => this.renderPresetCard(p, placeLabels)).join('')}
                  </div>
                ` : `
                  <div class="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white text-slate-500">
                    <i class="fa fa-bookmark text-4xl opacity-20 mb-3"></i>
                    <div class="font-black">No presets yet</div>
                    <div class="text-sm font-semibold mt-1">Use the templates on the left or paste your own Crexi URL.</div>
                  </div>
                `}
              </div>
            </div>

            <div class="mt-6 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div class="px-5 py-4 border-b border-slate-200 bg-slate-50">
                <h3 class="font-black text-slate-900">Place ID Labels</h3>
                <p class="text-xs text-slate-500 font-semibold mt-1">These are stored in Settings (settings.crexiPlaceLabels) and auto-fill City/State when you paste a known placeId.</p>
              </div>
              <div class="p-5">
                ${this.renderPlaceLabelTable(placeLabels)}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    this.bind(container);
  },

  renderPresetCard(preset, placeLabels) {
    const name = escapeHtml(preset?.name || 'Untitled Preset');
    const url = cleanStr(preset?.url);
    const city = cleanStr(preset?.city || preset?.location?.city || '');
    const state = cleanStr(preset?.state || preset?.location?.state || '');
    const label = cleanStr(preset?.locationLabel || preset?.location?.label || buildLocationLabel(city, state));

    const parseResult = url ? parseCrexiUrl(url) : { ok: false };
    const chips = parseResult?.ok ? parseResult.chips : [];
    const tags = Array.isArray(preset?.tags) ? preset.tags : [];

    // show known place label hints if placeIds exist
    let placeHint = '';
    if (parseResult?.ok && Array.isArray(parseResult.placeIds) && parseResult.placeIds.length) {
      const known = parseResult.placeIds
        .map(pid => placeLabels?.[pid])
        .filter(Boolean);
      if (known.length) {
        placeHint = `<div class="mt-2 text-[11px] font-black text-slate-700">Known label: <span class="font-semibold">${escapeHtml(known[0])}</span></div>`;
      }
    }

    return `
      <div class="p-4 rounded-2xl border border-slate-200 bg-white hover:border-orange-300 transition-all">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="font-black text-slate-900 truncate">${name}</div>
            <div class="text-xs text-slate-500 font-semibold truncate">${escapeHtml(label || 'No location label')}</div>
            ${placeHint}
          </div>

          <div class="flex items-center gap-1 flex-shrink-0">
            <button data-action="crexi-open" data-id="${escapeHtml(preset.id)}"
              class="w-9 h-9 rounded-xl bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center"
              title="Open in Crexi">
              <i class="fa fa-arrow-up-right-from-square text-sm"></i>
            </button>

            <button data-action="crexi-copy" data-id="${escapeHtml(preset.id)}"
              class="w-9 h-9 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 flex items-center justify-center"
              title="Copy URL">
              <i class="fa fa-copy text-sm"></i>
            </button>

            <button data-action="crexi-edit" data-id="${escapeHtml(preset.id)}"
              class="w-9 h-9 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 flex items-center justify-center"
              title="Edit">
              <i class="fa fa-pen text-sm"></i>
            </button>

            <button data-action="crexi-delete" data-id="${escapeHtml(preset.id)}"
              class="w-9 h-9 rounded-xl bg-white border border-red-200 hover:bg-red-50 text-red-700 flex items-center justify-center"
              title="Delete">
              <i class="fa fa-trash text-sm"></i>
            </button>
          </div>
        </div>

        ${chips.length ? `
          <div class="mt-3 flex flex-wrap gap-2">
            ${chips.slice(0, 8).map(c => `<span class="text-[11px] font-black px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">${escapeHtml(c)}</span>`).join('')}
          </div>
        ` : ''}

        ${tags.length ? `
          <div class="mt-3 flex flex-wrap gap-2">
            ${tags.slice(0, 12).map(t => `<span class="text-[11px] font-black px-2 py-1 rounded-lg bg-orange-50 border border-orange-200 text-orange-800">#${escapeHtml(t)}</span>`).join('')}
          </div>
        ` : ''}

        ${preset?.notes ? `
          <div class="mt-3 text-sm text-slate-600 font-semibold whitespace-pre-wrap">${escapeHtml(preset.notes)}</div>
        ` : ''}

        <div class="mt-3 text-[11px] text-slate-400 font-mono break-all">
          ${escapeHtml(url)}
        </div>
      </div>
    `;
  },

  renderPlaceIdHints(placeIds, placeLabels) {
    const known = (placeIds || [])
      .map(pid => ({ pid, label: placeLabels?.[pid] }))
      .filter(x => !!x.label);

    if (!known.length) return '';

    return `
      <div class="mt-2 text-xs text-slate-600">
        <div class="font-black text-slate-700">Known place label(s)</div>
        ${known.slice(0, 5).map(x => `
          <div class="mt-1">
            <span class="font-mono text-[11px]">${escapeHtml(x.pid)}</span>
            <span class="mx-2 text-slate-400">→</span>
            <span class="font-black">${escapeHtml(x.label)}</span>
          </div>
        `).join('')}
      </div>
    `;
  },

  renderPlaceLabelTable(placeLabels) {
    const entries = Object.entries(placeLabels || {});
    if (!entries.length) {
      return `
        <div class="py-10 text-center text-slate-500 border-2 border-dashed border-slate-200 rounded-2xl bg-white">
          <i class="fa fa-location-dot text-3xl opacity-20 mb-2"></i>
          <div class="font-black">No place labels saved yet</div>
          <div class="text-sm font-semibold mt-1">Save a preset that includes a placeId to store a label.</div>
        </div>
      `;
    }

    return `
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="text-left text-xs uppercase tracking-widest font-black text-slate-500">
              <th class="py-2 pr-4">Place ID</th>
              <th class="py-2 pr-4">Label</th>
            </tr>
          </thead>
          <tbody>
            ${entries
              .sort((a, b) => String(a[1]).localeCompare(String(b[1])))
              .map(([pid, label]) => `
                <tr class="border-t border-slate-100">
                  <td class="py-2 pr-4 font-mono text-[12px] text-slate-600 break-all">${escapeHtml(pid)}</td>
                  <td class="py-2 pr-4 font-black text-slate-900">${escapeHtml(label)}</td>
                </tr>
              `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  bind(container) {
    if (this._bound) return;
    this._bound = true;

    container.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;

      const action = btn.dataset.action;
      const id = btn.dataset.id;

      if (action === 'crexi-parse') {
        this.captureDraftFromInputs();
        const res = parseCrexiUrl(this._draft.url);
        this._lastParse = res;

        // auto-fill city/state if we have a saved mapping and city/state is blank
        if (res.ok && res.placeIds?.length === 1) {
          const st = stateManager.get();
          const labels = st?.settings?.crexiPlaceLabels || {};
          const known = labels?.[res.placeIds[0]];
          if (known && !cleanStr(this._draft.city) && !cleanStr(this._draft.state)) {
            // naive split "City, ST"
            const parts = String(known).split(',');
            const c = cleanStr(parts[0]);
            const s = cleanStr(parts[1] || '');
            this._draft.city = c;
            this._draft.state = s;
          }
        }

        this.render();
        return;
      }

      if (action === 'crexi-clear') {
        this._editingId = null;
        this._lastParse = null;
        this._draft = { name: '', url: '', city: '', state: '', tagsText: 'mf', notes: '' };
        this.render();
        return;
      }

      if (action === 'crexi-template-use') {
        const t = DEFAULT_TEMPLATES.find(x => x.id === id);
        if (!t) return;

        this._editingId = null;
        this._lastParse = null;
        this._draft = {
          name: `${t.title} | MF B/C $1–4M | 10–100u | Cap≥7.5 | Occ≥70`,
          url: t.url,
          city: t.city,
          state: t.state,
          tagsText: 'mf',
          notes: ''
        };

        // parse immediately for preview
        this._lastParse = parseCrexiUrl(this._draft.url);
        this.render();
        return;
      }

      if (action === 'crexi-open-draft') {
        this.captureDraftFromInputs();
        const res = parseCrexiUrl(this._draft.url);
        if (!res.ok) {
          modalManager.alert({ title: 'Invalid URL', message: res.error || 'Please paste a valid Crexi URL.' });
          return;
        }
        window.open(res.url, '_blank', 'noopener,noreferrer');
        return;
      }

      if (action === 'crexi-copy-draft') {
        this.captureDraftFromInputs();
        const res = parseCrexiUrl(this._draft.url);
        if (!res.ok) {
          modalManager.alert({ title: 'Invalid URL', message: res.error || 'Please paste a valid Crexi URL.' });
          return;
        }
        await this.copyToClipboard(res.url);
        return;
      }

      if (action === 'crexi-open') {
        const st = stateManager.get();
        const presets = Array.isArray(st.crexiPresets) ? st.crexiPresets : [];
        const p = presets.find(x => x.id === id);
        if (!p?.url) return;
        window.open(p.url, '_blank', 'noopener,noreferrer');
        return;
      }

      if (action === 'crexi-copy') {
        const st = stateManager.get();
        const presets = Array.isArray(st.crexiPresets) ? st.crexiPresets : [];
        const p = presets.find(x => x.id === id);
        if (!p?.url) return;
        await this.copyToClipboard(p.url);
        return;
      }

      if (action === 'crexi-edit') {
        const st = stateManager.get();
        const presets = Array.isArray(st.crexiPresets) ? st.crexiPresets : [];
        const p = presets.find(x => x.id === id);
        if (!p) return;

        this._editingId = p.id;
        this._lastParse = p.url ? parseCrexiUrl(p.url) : null;
        this._draft = {
          name: p.name || '',
          url: p.url || '',
          city: p.city || p?.location?.city || '',
          state: p.state || p?.location?.state || '',
          tagsText: Array.isArray(p.tags) ? p.tags.join(', ') : (p.tagsText || 'mf'),
          notes: p.notes || ''
        };

        this.render();
        return;
      }

      if (action === 'crexi-delete') {
        const st = stateManager.get();
        const presets = Array.isArray(st.crexiPresets) ? st.crexiPresets : [];
        const p = presets.find(x => x.id === id);
        if (!p) return;

        modalManager.confirm(
          'Delete preset?',
          `This will remove:\n\n${p.name || 'Untitled Preset'}\n\nYou can’t undo this.`,
          async () => {
            await stateManager.delete('crexiPresets', p.id);
            // if we were editing this one, clear editor
            if (this._editingId === p.id) {
              this._editingId = null;
              this._lastParse = null;
              this._draft = { name: '', url: '', city: '', state: '', tagsText: 'mf', notes: '' };
            }
            this.render();
          },
          { danger: true, confirmText: 'Delete' }
        );
        return;
      }

      if (action === 'crexi-save') {
        this.captureDraftFromInputs();

        const res = parseCrexiUrl(this._draft.url);
        this._lastParse = res;
        if (!res.ok) {
          modalManager.alert({ title: 'Cannot save', message: res.error || 'Please paste a valid Crexi URL.' });
          this.render();
          return;
        }

        const locLabel = buildLocationLabel(this._draft.city, this._draft.state);
        const tags = parseTags(this._draft.tagsText);

        // default name if blank
        let name = cleanStr(this._draft.name);
        if (!name) {
          const core = [];
          if (locLabel) core.push(locLabel);
          if (res.parsed?.types?.length) core.push(res.parsed.types.join('/'));
          if (res.parsed?.classes?.length) core.push(`Class ${res.parsed.classes.join('/')}`);
          if (res.parsed?.askingPriceMin != null || res.parsed?.askingPriceMax != null) {
            const left = res.parsed.askingPriceMin != null ? fmtMoneyShort(res.parsed.askingPriceMin) : '';
            const right = res.parsed.askingPriceMax != null ? fmtMoneyShort(res.parsed.askingPriceMax) : '';
            core.push(`${left}${left && right ? '–' : ''}${right}`.trim());
          }
          if (res.parsed?.unitMin != null || res.parsed?.unitMax != null) {
            const left = res.parsed.unitMin != null ? `${res.parsed.unitMin}` : '';
            const right = res.parsed.unitMax != null ? `${res.parsed.unitMax}` : '';
            core.push(`${left}${left && right ? '–' : ''}${right}u`.trim());
          }
          if (res.parsed?.capRateMin != null) core.push(`Cap≥${res.parsed.capRateMin}`);
          if (res.parsed?.occupancyMin != null) core.push(`Occ≥${res.parsed.occupancyMin}`);
          name = core.filter(Boolean).join(' | ') || 'Crexi Preset';
        }

        const presetPayload = {
          name,
          url: res.url,
          city: titleCase(this._draft.city),
          state: normalizeStateCode(this._draft.state),
          locationLabel: locLabel,
          tags,
          notes: cleanStr(this._draft.notes)
        };

        if (this._editingId) {
          await stateManager.update('crexiPresets', this._editingId, presetPayload);
        } else {
          await stateManager.add('crexiPresets', presetPayload);
        }

        // save placeId label mapping if present and label is provided
        if (res.placeIds?.length && locLabel) {
          const st = stateManager.get();
          const existing = st?.settings?.crexiPlaceLabels || {};
          let changed = false;
          const next = { ...existing };

          for (const pid of res.placeIds) {
            if (!pid) continue;
            if (next[pid] !== locLabel) {
              next[pid] = locLabel;
              changed = true;
            }
          }

          if (changed) {
            await stateManager.updateSettings({ crexiPlaceLabels: next });
          }
        }

        // reset editor after save
        this._editingId = null;
        this._lastParse = null;
        this._draft = { name: '', url: '', city: '', state: '', tagsText: 'mf', notes: '' };
        this.render();
        return;
      }
    });

    // Re-render preview when they blur out of URL field (nice UX, low risk)
    container.addEventListener('blur', (e) => {
      const el = e.target;
      if (!(el instanceof HTMLElement)) return;
      if (el.id !== 'crexi_url') return;

      this.captureDraftFromInputs();
      const res = parseCrexiUrl(this._draft.url);
      this._lastParse = res;
      this.render();
    }, true);
  },

  async copyToClipboard(text) {
    const t = cleanStr(text);
    if (!t) return;

    try {
      await navigator.clipboard.writeText(t);
      modalManager.alert({ title: 'Copied', message: 'Crexi URL copied to clipboard.' });
    } catch (_) {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = t;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        modalManager.alert({ title: 'Copied', message: 'Crexi URL copied to clipboard.' });
      } catch (err) {
        modalManager.alert({ title: 'Copy failed', message: 'Your browser blocked clipboard access.' });
      } finally {
        document.body.removeChild(ta);
      }
    }
  },

  captureDraftFromInputs() {
    const name = document.getElementById('crexi_name')?.value;
    const city = document.getElementById('crexi_city')?.value;
    const state = document.getElementById('crexi_state')?.value;
    const tagsText = document.getElementById('crexi_tags')?.value;
    const url = document.getElementById('crexi_url')?.value;
    const notes = document.getElementById('crexi_notes')?.value;

    this._draft = {
      name: name ?? this._draft.name,
      city: city ?? this._draft.city,
      state: state ?? this._draft.state,
      tagsText: tagsText ?? this._draft.tagsText,
      url: url ?? this._draft.url,
      notes: notes ?? this._draft.notes
    };
  }
};
